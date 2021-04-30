"""
Microservice that provides temporary user credentials to the catalog
"""

from datetime import timedelta

import json
import os
import boto3
import requests
from botocore.exceptions import ClientError
from flask import Flask, request
from flask_cors import CORS, cross_origin
from flask_json import as_json

# delete below
#from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
#from elasticsearch import Elasticsearch, RequestsHttpConnection

from t4_lambda_shared.utils import (
    PACKAGE_INDEX_SUFFIX,
    get_default_origins,
    make_json_response,
)

from .backends import get_package_registry

app = Flask(__name__)  # pylint: disable=invalid-name
app.config['JSON_USE_ENCODE_METHODS'] = True
app.config['JSON_ADD_STATUS'] = False

sts_client = boto3.client(  # pylint: disable=invalid-name
    'sts',
)


class ApiException(Exception):
    """
    Base class for API exceptions.
    """
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message


CORS(app, resources={
    "/api/*": {"origins": "*", "max_age": timedelta(days=1)},
    "/prod/*": {"origins": "*", "max_age": timedelta(days=1)}
})


@app.route('/api/buckets', methods=['GET'])
@as_json
def list_buckets():
    """
    Returns an empty list for compatibility
    """
    return dict(
        buckets=[]
    )


@app.route('/api/auth/get_credentials', methods=['GET'])
@as_json
def get_credentials():
    """
    Obtains credentials corresponding to your role.

    Returns a JSON object with three keys:
        AccessKeyId(string): access key ID
        SecretKey(string): secret key
        SessionToken(string): session token
    """
    try:
        creds = sts_client.get_session_token()
    except ClientError as ex:
        print(ex)
        raise ApiException(requests.codes.server_error,
                           "Failed to get credentials for your AWS Account.")
    return creds['Credentials']

###########################
# API Gateway methods
###########################

# Delete these
DEFAULT_SIZE = 1_000
MAX_QUERY_DURATION = 27  # Just shy of 29s API Gateway limit
NUM_PREVIEW_IMAGES = 100
NUM_PREVIEW_FILES = 20
COMPRESSION_EXTS = ['.gz']
IMG_EXTS = r'.*\.(bmp|gif|jpg|jpeg|png|tif|tiff|webp)'
SAMPLE_EXTS = r'.*\.(csv|ipynb|json|md|parquet|pdf|rmd|tsv|txt|vcf|xls|xlsx)(.gz)?'
README_KEYS = ['README.md', 'README.txt', 'README.ipynb']
SUMMARIZE_KEY = 'quilt_summarize.json'

@app.route('/prod/search', methods=['GET'])
@as_json
def search():
    """
    Implementation for package listing
    """
    print(request.args)

    action = request.args.get('action')
    user_body = request.args.get('body', {})
    user_fields = request.args.get('fields', [])
    user_indexes = request.args.get('index', "")
    user_size = request.args.get('size', DEFAULT_SIZE)
    user_source = request.args.get('_source', [])
    # 0-indexed starting position (for pagination)
    user_from = int(request.args.get('from', 0))
    user_retry = int(request.args.get('retry', 0))
    filter_path = request.args.get('filter_path')

    query = request.args.get('query', '')
    body = user_body or {
        "query": {
            "query_string": {
                "analyze_wildcard": True,
                "lenient": True,
                "query": query,
                # see enterprise/**/bucket.py for mappings
                "fields": [
                    # package
                    'comment', 'handle', 'handle_text^2', 'metadata', 'tags'
                ]
            }
        }
    }

    if not all(i.endswith(PACKAGE_INDEX_SUFFIX) for i in user_indexes.split(',')):
        raise ValueError(f"'packages' action to index that doesn't end in {PACKAGE_INDEX_SUFFIX}")
    _source = user_source
    size = user_size
    terminate_after = None

    assert user_body
    assert user_indexes
    body_dict = json.loads(user_body)

    if 'packages' in body_dict['aggs']:
        # totals
        total_rev_count = 0
        last_key = ""
        package_summary = dict()

        # List packages in Python
        bucket = f"s3://{user_indexes.rstrip('_packages')}"
        pkg_reg = get_package_registry(bucket)
        print(pkg_reg)
        for package, ts, hash in pkg_reg.list_all_package_pointers():
            print(package)
            last_key = package
            total_rev_count += 1

            if package not in package_summary:
                package_summary[package] = (1, ts)                    
            else:
                rev_count, min_ts = package_summary[package]
                rev_count += 1
                min_ts = min(ts, min_ts) if min_ts else ts
                package_summary[package] = (rev_count, min_ts)

        buckets = []
        for package, summary in package_summary.items():
            rev_count, min_ts = summary
            rev_summary = dict(
                key=dict(handle=package),
                doc_count=rev_count,
                modified=dict(value=min_ts, value_as_string=str(min_ts))
            )
            buckets.append(rev_summary)
            total_rev_count += rev_count
        return {
            "took": 1,
            "timed_out": False,
            "hits": {
                "total": total_rev_count,
                "max_score": 0,
                "hits": []
            },
            "aggregations": {
                "packages": {
                    "after_key": {
                        "handle": last_key
                    },
                    "buckets": buckets   
                }
            }
        }
    else:
        # totals
        pkg_count = 0
        # List packages in Python
        bucket = f"s3://{user_indexes.rstrip('_packages')}"
        pkg_reg = get_package_registry(bucket)
        for package in pkg_reg.list_packages():
            print(package)
            pkg_count += 1

        return {
            'python': True,
            'took': 1,
            'timed_out': False,
            '_shards': {'total': 1, 'successful': 1, 'skipped': 0, 'failed': 0},
            'hits': {'total': 156, 'max_score': 0.0, 'hits': []},
            'aggregations': {'total': {'value': pkg_count}}
        }


"""
Provide the head of a (potentially gzipped) file in S3. Stream to limit
disk and RAM pressure.

Lambda functions can have up to 3GB of RAM and only 512MB of disk.
"""
import io
import os
from contextlib import redirect_stderr
from urllib.parse import urlparse

import pandas
import requests

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.preview import (
    CATALOG_LIMIT_BYTES,
    CATALOG_LIMIT_LINES,
    TRUNCATED,
    extract_fcs,
    extract_parquet,
    get_bytes,
    get_preview_lines,
    remove_pandas_footer,
)
from t4_lambda_shared.utils import get_default_origins, make_json_response

# Number of bytes for read routines like decompress() and
# response.content.iter_content()
CHUNK = 1024*8
# We can pump a max of 6MB out of Lambda
LAMBDA_MAX_OUT = 6_000_000
MIN_VCF_COLS = 8  # per 4.2 spec on header and data lines

S3_DOMAIN_SUFFIX = '.amazonaws.com'

FILE_EXTENSIONS = ["csv", "excel", "fcs", "ipynb", "parquet", "vcf"]
# BED https://genome.ucsc.edu/FAQ/FAQformat.html#format1
TEXT_TYPES = ["bed", "txt"]
FILE_EXTENSIONS.extend(TEXT_TYPES)

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        },
        # separator for CSV files
        'sep': {
            'minLength': 1,
            'maxLength': 1
        },
        'max_bytes': {
            'type': 'string',
        },
        # line_count used to be an integer with a max and min, which is more correct
        # nevertheless, request.args has it as a string, even if
        # the request specifies it as an integer
        'line_count': {
            'type': 'string',
        },
        'input': {
            'enum': FILE_EXTENSIONS
        },
        'exclude_output': {
            'enum': ['true', 'false']
        },
        'compression': {
            'enum': ['gz']
        }
    },
    'required': ['url', 'input'],
    'additionalProperties': False
}

# global option for pandas
pandas.set_option('min_rows', 50)

@app.route('/prod/preview', methods=['GET'])
@as_json
def preview():
    """
    dynamically handle preview requests for bytes in S3
    caller must specify input_type (since there may be no file extension)

    Returns:
        JSON response
    """
    url = request.args['url']
    input_type = request.args.get('input')
    compression = request.args.get('compression')
    separator = request.args.get('sep') or ','
    exclude_output = request.args.get('exclude_output') == 'true'
    try:
        max_bytes = int(request.args.get('max_bytes', CATALOG_LIMIT_BYTES))
    except ValueError as error:
        return make_json_response(400, {
            'title': 'Unexpected max_bytes= value',
            'detail': str(error)
        })

    parsed_url = urlparse(url, allow_fragments=False)
    if not (parsed_url.scheme == 'https' and
            parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
            parsed_url.username is None and
            parsed_url.password is None):
        return make_json_response(400, {
            'title': 'Invalid url=. Expected S3 virtual-host URL.'
        })

    try:
        line_count = _str_to_line_count(request.args.get('line_count', str(CATALOG_LIMIT_LINES)))
    except ValueError as error:
        # format https://jsonapi.org/format/1.1/#error-objects
        return make_json_response(
            400,
            {
                'title': 'Unexpected line_count= value',
                'detail': str(error)
            }
        )

    # stream=True saves memory almost equal to file size
    resp = requests.get(url, stream=True)
    if resp.ok:
        content_iter = resp.iter_content(CHUNK)
        if input_type == 'csv':
            html, info = extract_csv(
                get_preview_lines(content_iter, compression, line_count, max_bytes),
                separator
            )
        elif input_type == 'excel':
            html, info = extract_excel(get_bytes(content_iter, compression))
        elif input_type == 'fcs':
            html, info = extract_fcs(get_bytes(content_iter, compression))
        elif input_type == 'ipynb':
            html, info = extract_ipynb(get_bytes(content_iter, compression), exclude_output)
        elif input_type == 'parquet':
            html, info = extract_parquet(get_bytes(content_iter, compression))
        elif input_type == 'vcf':
            html, info = extract_vcf(
                get_preview_lines(content_iter, compression, line_count, max_bytes)
            )
        elif input_type in TEXT_TYPES:
            html, info = extract_txt(
                get_preview_lines(content_iter, compression, line_count, max_bytes)
            )
        else:
            assert False, f'unexpected input_type: {input_type}'

        assert isinstance(html, str), 'expected html parameter as string'
        assert isinstance(info, dict), 'expected info metadata to be a dict'

        ret_val = {
            'info': info,
            'html': html,
        }
    else:
        ret_val = {
            'error': resp.reason,
            'text': resp.text,
        }

    return ret_val


def extract_csv(head, separator):
    """
    csv file => data frame => html
    Args:
        file_ - file-like object opened in binary mode, pointing to .csv
    Returns:
        html - html version of *first sheet only* in workbook
        info - metadata
    """
    warnings_ = io.StringIO()
    # this shouldn't balloon memory because head is limited in size by get_preview_lines
    try:
        data = pandas.read_csv(
            io.StringIO('\n'.join(head)),
            sep=separator
        )

    except pandas.errors.ParserError:
        # temporarily redirect stderr to capture warnings (usually errors)
        with redirect_stderr(warnings_):
            data = pandas.read_csv(
                io.StringIO('\n'.join(head)),
                error_bad_lines=False,
                warn_bad_lines=True,
                # sep=None is slower (doesn't use C), deduces the separator
                sep=None
            )

    html = remove_pandas_footer(data._repr_html_())  # pylint: disable=protected-access

    return html, {
        'note': TRUNCATED,
        'warnings': warnings_.getvalue()
    }


def extract_excel(file_):
    """
    excel file => data frame => html
    Args:
        file_ - file-like object opened in binary mode, pointing to XLS or XLSX
    Returns:
        html - html version of *first sheet only* in workbook
        info - metadata
    """
    first_sheet = pandas.read_excel(file_, sheet_name=0)
    html = remove_pandas_footer(first_sheet._repr_html_())  # pylint: disable=protected-access
    return html, {}


def extract_ipynb(file_, exclude_output: bool):
    """
    parse and extract ipynb files

    Args:
        file_ - file-like object opened in binary mode (+b)

    Returns:
        html - html version of notebook
        info - unmodified (is also passed in)
    """
    # local import reduces amortized latency, saves memory
    import nbformat
    from nbconvert import HTMLExporter

    # get the file size
    file_.seek(0, os.SEEK_END)
    size = file_.tell()
    if size > LAMBDA_MAX_OUT:
        exclude_output = True
    # rewind
    file_.seek(0, os.SEEK_SET)

    info = {}
    if exclude_output:
        info['warnings'] = "Omitted cell outputs to reduce notebook size"

    html_exporter = HTMLExporter()
    html_exporter.template_file = 'basic'
    html_exporter.exclude_output = exclude_output

    notebook = nbformat.read(file_, 4)
    html, _ = html_exporter.from_notebook_node(notebook)

    return html, info


def extract_vcf(head):
    """
    Pull summary info from VCF: meta-information, header line, and data lines
    VCF file format: https://github.com/samtools/hts-specs/blob/master/VCFv4.3.pdf

    Args:
        array of first few lines of file
    Returns:
        dict
    """
    meta = []
    header = None
    data = []
    variants = []
    limit = MIN_VCF_COLS + 1  # +1 to get the FORMAT column
    for line in head:
        if line.startswith('##'):
            meta.append(line)
        elif line.startswith('#'):
            if header:
                print('Unexpected multiple headers:', header)
            header = line
            columns = header.split()  # VCF is tab-delimited
            # only grab first "limit"-many rows
            header = columns[:limit]
            variants = columns[limit:]
        elif line:
            columns = line.split()[:limit]
            data.append(columns)
    info = {
        'data': {
            'meta': meta,
            'header': header,
            'data': data
        },
        'metadata': {
            'variants': variants,
            'variant_count': len(variants)
        }
    }

    return '', info


def extract_txt(head):
    """
    dummy formatting function
    """
    info = {
        'data': {
            'head': head,
            # retain tail for backwards compatibility with client
            'tail': []
        }
    }

    return '', info


def _str_to_line_count(int_string, lower=1, upper=CATALOG_LIMIT_LINES):
    """
    validates an integer string

    Raises: ValueError
    """
    integer = int(int_string)
    if integer < lower or integer > upper:
        raise ValueError(f'{integer} out of range: [{lower}, {upper}]')

    return integer


###################################
# PkgSelect
###################################

"""
Provide a virtual-file-system view of a package's logical keys.
"""

import json
import os

import boto3
import botocore
import pandas as pd

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import (
    get_default_origins,
    make_json_response,
    query_manifest_content,
    sql_escape,
)

SCHEMA = {
    'type': 'object',
    'properties': {
        'bucket': {
            'type': 'string'
        },
        'manifest': {
            'type': 'string'
        },
        'access_key': {
            'type': 'string'
        },
        'secret_key': {
            'type': 'string'
        },
        'session_token': {
            'type': 'string'
        },
        'prefix': {
            'type': 'string'
        },
        'logical_key': {
            'type': 'string'
        },
        'offset': {
            'type': 'integer'
        },
        'limit': {
            'type': 'integer'
        }
    },
    'required': ['bucket', 'manifest'],
    'additionalProperties': False
}


def file_list_to_folder(df: pd.DataFrame, limit: int, offset: int) -> dict:
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    if {'physical_key', 'logical_key', 'size'}.issubset(df.columns):
        groups = df.groupby(df.logical_key.str.extract('([^/]+/?).*')[0], dropna=True)
        folder = groups.agg(
            size=('size', 'sum'),
            physical_key=('physical_key', 'first')
        )
        folder.reset_index(inplace=True)  # move the logical_key from the index to column[0]
        folder.rename(columns={0: 'logical_key'}, inplace=True)  # name the new column

        # Sort to ensure consistent paging
        folder.sort_values(by=['logical_key'], inplace=True)

        # Page response (folders and files) based on limit & offset
        total_results = len(folder.index)
        folder = folder.iloc[offset:offset+limit]

        # Do not return physical_key for prefixes
        prefixes = folder[folder.logical_key.str.contains('/')].drop(
            ['physical_key'],
            axis=1
        ).to_dict(orient='records')
        objects = folder[~folder.logical_key.str.contains('/')].to_dict(orient='records')
    else:
        # df might not have the expected columns if either: (1) the
        # package is empty (has zero package entries) or, (2) zero
        # package entries match the prefix filter. In either case,
        # the folder view is empty.
        prefixes = []
        objects = []
        total_results = 0

    returned_results = len(prefixes) + len(objects)
    return dict(
        total=total_results,
        returned=returned_results,
        prefixes=prefixes,
        objects=objects
    )


def create_s3_client(
    *,
    aws_access_key_id: str,
    aws_secret_access_key: str,
    aws_session_token: str
):
    """
    Create an S3 Client using caller-provided credentials.
    """
    assert aws_access_key_id and aws_secret_access_key and aws_session_token
    session = boto3.Session(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_session_token=aws_session_token
    )
    return session.client('s3')


@app.route('/prod/pkgselect', methods=['GET'])
@as_json
def pkgselect():
    """
    Parse a manifest to return a folder-like view of its contents (logical keys).

    Returns:
        JSON response
    """
    bucket = request.args['bucket']
    key = request.args['manifest']
    prefix = request.args.get('prefix')
    logical_key = request.args.get('logical_key')
    access_key = request.args.get('access_key')
    secret_key = request.args.get('secret_key')
    session_token = request.args.get('session_token')
    limit = request.args.get('limit', 1000)
    offset = request.args.get('offset', 0)
    allow_anonymous_access = bool(os.getenv('ALLOW_ANONYMOUS_ACCESS'))

    # If credentials are passed in, use them
    # for the client. If no credentials are supplied, test that
    # the manifest object is publicly accessible. If so, create
    # an s3 client using the underlying IAM role's permissions.

    if access_key and secret_key and session_token:
        s3_client = create_s3_client(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=session_token
        )
    elif (
        allow_anonymous_access and
        access_key is None and
        secret_key is None and
        session_token is None
    ):
        # Test to see if the target key is publicly accessible. If not, the call
        # below will raise and exception and return a 403 response
        anons3 = boto3.client(
            's3',
            config=botocore.client.Config(signature_version=botocore.UNSIGNED)
        )
        try:
            anons3.head_object(Bucket=bucket, Key=key)
        except botocore.exceptions.ClientError as error:
            if error.response.get('Error'):
                code = error.response['Error']['Code']
                if code == '403':
                    return make_json_response(
                        403,
                        {
                            'title': 'Access Denied',
                            'detail': f"Access denied reading manifest: {key}"
                        }
                    )
            raise error

        # Use the default S3 client configuration
        s3_client = boto3.client('s3')
    else:
        return make_json_response(
            401,
            {
                'title': 'Incomplete credentials',
                'detail': "access_key, secret_key and session_token are required"
            }
        )
    assert s3_client

    # Get details of a single file in the package
    if logical_key is not None:
        sql_stmt = f"SELECT s.* FROM s3object s WHERE s.logical_key = '{sql_escape(logical_key)}' LIMIT 1"
        response_data = json.load(query_manifest_content(
            s3_client,
            bucket=bucket,
            key=key,
            sql_stmt=sql_stmt
        ))
    else:
        # Call s3 select to fetch only logical keys matching the
        # desired prefix (folder path)
        prefix_length = len(prefix) if prefix is not None else 0
        sql_stmt = (
            f"SELECT SUBSTRING(s.logical_key, {prefix_length + 1}) AS logical_key"
            ", s.\"size\", s.physical_keys[0] as physical_key FROM s3object s"
        )
        if prefix:
            sql_stmt += f" WHERE SUBSTRING(s.logical_key, 1, {prefix_length}) = '{sql_escape(prefix)}'"
        result = query_manifest_content(
            s3_client,
            bucket=bucket,
            key=key,
            sql_stmt=sql_stmt
        )

        # Parse the response into a logical folder view
        if result is not None:
            df = pd.read_json(
                result,
                lines=True,
                dtype=dict(
                    logical_key='string',
                    physical_key='string'
                )
            )
        else:
            df = pd.DataFrame()
        response_data = file_list_to_folder(df, limit, offset)

        # Fetch package-level or directory-level metadata
        if prefix:
            sql_stmt = f"SELECT s.meta FROM s3object s WHERE s.logical_key = '{sql_escape(prefix)}'"
        else:
            sql_stmt = "SELECT s.* FROM s3object s WHERE s.logical_key is NULL"
        result = query_manifest_content(
            s3_client,
            bucket=bucket,
            key=key,
            sql_stmt=sql_stmt
        )
        meta = json.load(result) if result else {}
        response_data.update(dict(meta=meta))

    ret_val = {
        'contents': response_data
    }

    return ret_val


# Start Flask
if __name__ == '__main__':
    app.run()
