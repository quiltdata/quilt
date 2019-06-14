"""
phone data into elastic for supported file extensions
"""
from datetime import datetime
import json
import os
from urllib.parse import unquote

from aws_requests_auth.aws_auth import AWSRequestsAuth
import botocore
import boto3
from elasticsearch import Elasticsearch, RequestsHttpConnection
from elasticsearch.exceptions import RequestError
import nbformat
import tenacity

DEFAULT_CONFIG = {
    'to_index': [
        '.ipynb',
        '.md',
        '.rmd',
    ]
}

NB_VERSION = 4 # default notebook version for nbformat

S3_CLIENT = boto3.client("s3")

def get_config(bucket):
    """return a dict of DEFAULT_CONFIG merged the user's config (if available)"""
    # TODO - do not fetch from S3 for this; it's slow and we can get throttled
    try:
        loaded_object = S3_CLIENT.get_object(Bucket=bucket, Key='.quilt/config.json')
        loaded_config = json.load(loaded_object['Body'])
        return {**DEFAULT_CONFIG, **loaded_config}
    except botocore.exceptions.ClientError:
        return DEFAULT_CONFIG
    except Exception as e:
        print('Exception when getting config')
        print(e)
        import traceback
        traceback.print_tb(e.__traceback__)

        return DEFAULT_CONFIG

def transform_meta(meta):
    ''' Reshapes metadata for indexing in ES '''
    helium = meta.get('helium')
    user_meta = {}
    comment = ''
    target = ''
    meta_text = ''
    if helium:
        user_meta = helium.pop('user_meta', {})
        comment = helium.pop('comment', '') or ''
        target = helium.pop('target', '') or ''
    meta_text_parts = [comment, target]
    if helium:
        meta_text_parts.append(json.dumps(helium))
    if user_meta:
        meta_text_parts.append(json.dumps(user_meta))
    if meta_text_parts:
        meta_text = ' '.join(meta_text_parts)
    result = {
        'system_meta': helium,
        'user_meta': user_meta,
        'comment': comment,
        'target': target,
        'meta_text': meta_text
    }
    return result

def extract_text(notebook_str):
    """ Extract code and markdown
    Args:
        * nb - notebook as a string
    Returns:
        * str - select code and markdown source (and outputs)
    Pre:
        * notebook is well-formed per notebook version 4
        * 'cell_type' is defined for all cells
        * 'source' defined for all 'code' and 'markdown' cells
    Throws:
        * Anything nbformat.reads() can throw :( which is diverse and poorly
        documented, hence the `except Exception` in handler()
    Notes:
        * Deliberately decided not to index output streams and display strings
        because they were noisy and low value
        * Tested this code against ~6400 Jupyter notebooks in
        s3://alpha-quilt-storage/tree/notebook-search/
        * Might be useful to index "cell_type" : "raw" in the future
    See also:
        * Format reference https://nbformat.readthedocs.io/en/latest/format_description.html
    """
    formatted = nbformat.reads(notebook_str, as_version=NB_VERSION)
    text = []
    for cell in formatted.get('cells', []):
        if 'source' in cell and 'cell_type' in cell:
            if cell['cell_type'] == 'code' or cell['cell_type'] == 'markdown':
                text.append(cell['source'])

    return '\n'.join(text)

def post_to_es(event_type, size, text, key, meta, version_id=''):
    """structure and send data to ElasticSearch"""

    ES_HOST = os.environ['ES_HOST']
    ES_INDEX = 'drive'

    data = {
        'type': event_type,
        'size': size,
        'text': text,
        'key': key,
        'updated': datetime.utcnow().isoformat(),
        'version_id': version_id
    }
    data = {**data, **transform_meta(meta)}
    data['meta_text'] = ' '.join([data['meta_text'], key])
    try:
        session = boto3.session.Session()
        awsauth = AWSRequestsAuth(
            aws_access_key=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
            aws_token=os.environ['AWS_SESSION_TOKEN'],
            aws_host=ES_HOST,
            aws_region=session.region_name,
            aws_service='es'
        )

        es = Elasticsearch(
            hosts=[{'host': ES_HOST, 'port': 443}],
            http_auth=awsauth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection
        )

        res = es.index(
            index=ES_INDEX,
            doc_type='_doc',
            body=data
            refresh='wait_for'
        )
        print(res)
    except RequestError as e:
        if e.error == 'mapper_parsing_exception':
            # retry with just plaintext stuff
            print('Mapping exception. Retrying without user_meta and system_meta')
            data['user_meta'] = {}
            data['system_meta'] = {}
            try:
                res = es.index(index=ES_INDEX, doc_type='_doc', body=data)
                print(res)
            except Exception as e:
                print('Failover failed. data: ' + json.dumps(data))
                print(e)
                import traceback
                traceback.print_tb(e.__traceback__)
        else:
            print("Exception encountered when POSTing to ES")
            print(e)
            import traceback
            traceback.print_tb(e.__traceback__)

    except Exception as e:
        print("Exception encountered when POSTing to ES")
        print(e)
        import traceback
        traceback.print_tb(e.__traceback__)

def handler(event, _):
    """fetch the S3 object from event, extract relevant data and metadata,
    dispatch post_to_es
    """
    try:
        for msg in event['Records']:
            for record in json.loads(json.loads(msg['body'])['Message'])['Records']:
                try:
                    eventname = record['eventName']
                    bucket = unquote(record['s3']['bucket']['name'])
                    key = unquote(record['s3']['object']['key'])
                    version_id = record['s3']['object'].get('versionId')
                    version_id = unquote(version_id) if version_id else None
                    etag = unquote(record['s3']['object']['eTag'])

                    if eventname == 'ObjectRemoved:Delete':
                        event_type = 'Delete'
                        post_to_es(event_type, 0, '', key, {})
                        continue
                    elif eventname == 'ObjectCreated:Put':
                        event_type = 'Create'
                    else:
                        event_type = eventname
                    try:
                        # Retry with back-off for eventual consistency reasons
                        # TODO only get object body if we need to plaintext index
                        # TODO use batch calls!
                        @tenacity.retry(wait=tenacity.wait_exponential(multiplier=2, min=4, max=30))
                        def get_obj_from_s3(bucket, key, version_id=None, etag=None):
                            if version_id:
                                response = S3_CLIENT.get_object(Bucket=bucket, Key=key, VersionId=version_id)
                            else:
                                response = S3_CLIENT.get_object(Bucket=bucket, Key=key)
                                # assert etag match, otherwise raise exception and let retry handle a new
                                # request.
                                if response['ETag'] != etag:
                                    raise Exception("Failed to retrieve most recent object matching eTag in "
                                                    "bucket notification.")
                            return response
                        response = get_obj_from_s3(bucket, key, version_id, etag)

                    except botocore.exceptions.ClientError as e:
                        print("Exception while getting object")
                        print(e)
                        print(bucket)
                        print(key)
                        raise

                    size = response['ContentLength']
                    meta = response['Metadata']
                    text = ''

                    to_index = get_config(bucket).get('to_index', [])
                    to_index = [x.lower() for x in to_index]
                    _, ext = os.path.splitext(key)
                    ext = ext.lower()
                    if ext in to_index:
                        # try to index data from the object itself
                        if ext in ['.md', '.rmd']:
                            try:
                                # TODO fetch body here
                                text = response['Body'].read().decode('utf-8')
                            except UnicodeDecodeError:
                                print("Unicode decode error in .md file")
                        elif ext == '.ipynb':
                            try:
                                # TODO fetch body here
                                notebook = response['Body'].read().decode('utf-8')
                                text = extract_text(notebook)
                            except UnicodeDecodeError as uni:
                                print("Unicode decode error in {}: {} ".format(key, uni))
                            except (json.JSONDecodeError, nbformat.reader.NotJSONError):
                                print("Invalid JSON in {}.".format(key))
                            except (KeyError, AttributeError)  as err:
                                print("Missing key in {}: {}".format(key, err))
                            # there might be more errors than covered by test_read_notebook
                            # better not to fail altogether
                            except Exception as exc:#pylint: disable=broad-except
                                print("Exception in file {}: {}".format(key, exc))
                        else:
                            # TODO: phone this into mixpanel
                            print(f"no logic to index {ext}")

                    # decode helium metadata
                    try:
                        meta['helium'] = json.loads(meta['helium'])
                    except (KeyError, json.JSONDecodeError):
                        print('decoding helium metadata failed')

                    post_to_es(event_type, size, text, key, meta, version_id)
                except Exception as e:
                    # do our best to process each result
                    print("Exception encountered for record")
                    print(e)
                    import traceback
                    traceback.print_tb(e.__traceback__)
                    print(msg)
    except Exception as e:
        # do our best to process each result
        print("Exception encountered for whole Event")
        print(e)
        import traceback
        traceback.print_tb(e.__traceback__)
        print(event)
        # TODO: Fail the lambda so the message is not dequeued.
        # raise e