"""
bucket.py

Contains the Bucket class, which provides several useful functions
    over an s3 bucket.
"""
import pathlib
from urllib.parse import urlparse

from .data_transfer import copy_file, delete_object, list_object_versions, list_objects, select
from .search_util import search_api
from .util import QuiltException, find_bucket_config, fix_url, get_from_config, parse_s3_url


class Bucket(object):
    """Bucket interface for Quilt.
    """
    def __init__(self, bucket_uri):
        """
        Creates a Bucket object.

        Args:
            bucket_uri(str): URI of bucket to target. Must start with 's3://'

        Returns:
            A new Bucket
        """
        parsed = urlparse(bucket_uri)
        bucket, path, version_id = parse_s3_url(parsed)
        if path or version_id:
            raise QuiltException("Bucket URI shouldn't contain a path or a version ID")

        self._uri = 's3://{}/'.format(bucket)
        self._bucket = bucket
        self._search_endpoint = None
        self._region = None

    def config(self, config_url=None):
        """
        Updates this bucket's search endpoint based on a federation config.
        """
        if not config_url:
            navigator_url = get_from_config('navigator_url')
            if not navigator_url:
                raise QuiltException("Must set `quilt.config(navigator_url)`, where `navigator_url` is the URL "
                                     "of your catalog homepage.")

            navigator_url.rstrip('/') # remove trailing / if present
            config_url = navigator_url + '/config.json'

        # Look for search endpoint in stack config
        # Only fall back on bucket config for old stacks
        bucket_config = find_bucket_config(self._bucket, config_url)
        if 'searchEndpoint' in bucket_config:
            self._search_endpoint = bucket_config['searchEndpoint']
        elif 'search_endpoint' in bucket_config:
            # old format
            self._search_endpoint = bucket_config['search_endpoint']
        # TODO: we can maybe get this from searchEndpoint or apiGatewayEndpoint
        self._region = bucket_config.get('region', 'us-east-1')

    def search(self, query, limit=10):
        """
        Execute a search against the configured search endpoint.

        Args:
            query (str): query string to search
            limit (number): maximum number of results to return. Defaults to 10

        Query Syntax:
            By default, a normal plaintext search will be executed over the query string.
            You can use field-match syntax to filter on exact matches for fields in
                your metadata.
            The syntax for field match is `user_meta.$field_name:"exact_match"`.

        Returns:
            a list of objects with the following structure:
            ```
            [{
                "key": <key of the object>,
                "version_id": <version_id of object version>,
                "operation": <"Create" or "Delete">,
                "meta": <metadata attached to object>,
                "size": <size of object in bytes>,
                "text": <indexed text of object>,
                "source": <source document for object (what is actually stored in ElasticSeach)>,
                "time": <timestamp for operation>,
            }...]
            ```
        """
        return search_api(query, index=self._bucket, limit=limit)

    def put_file(self, key, path):
        """
        Stores file at path to key in bucket.

        Args:
            key(str): key in bucket to store file at
            path(str): string representing local path to file

        Returns:
            None

        Raises:
            * if no file exists at path
            * if copy fails
        """
        dest = self._uri + key
        copy_file(fix_url(path), dest)

    def put_dir(self, key, directory):
        """
        Stores all files in the `directory` under the prefix `key`.

        Args:
            key(str): prefix to store files under in bucket
            directory(str): path to local directory to grab files from

        Returns:
            None

        Raises:
            * if directory isn't a valid local directory
            * if writing to bucket fails
        """
        # Ensure key ends in '/'.
        if key and key[-1] != '/':
            key += '/'

        src_path = pathlib.Path(directory)
        if not src_path.is_dir():
            raise QuiltException("Provided directory does not exist")

        source_dir = src_path.resolve().as_uri() + '/'
        s3_uri_prefix = self._uri + key
        copy_file(source_dir, s3_uri_prefix)

    def keys(self):
        """
        Lists all keys in the bucket.

        Returns:
            List of strings
        """
        return [x.get('Key') for x in list_objects(self._bucket, '')]

    def delete(self, key):
        """
        Deletes a key from the bucket.

        Args:
            key(str): key to delete

        Returns:
            None

        Raises:
            * if delete fails
        """
        if not key:
            raise QuiltException("Must specify the key to delete")

        if key[-1] == '/':
            raise QuiltException("Must use delete_dir to delete directories")

        delete_object(self._bucket, key)

    def delete_dir(self, path):
        """Delete a directory and all of its contents from the bucket.

        Parameters:
                path (str): path to the directory to delete
        """
        results = list_objects(self._bucket, path)
        for result in results:
            self.delete(result['Key'])

    def ls(self, path=None, recursive=False):
        """List data from the specified path.

        Parameters:
            path (str): bucket path to list
            recursive (bool): show subdirectories and their contents as well

        Returns:
            ``list``: Return value structure has not yet been permanently decided
            Currently, it's a ``tuple`` of ``list`` objects, containing the
            following: (directory info, file/object info, delete markers).
        """
        if path and not path.endswith('/'):
            path += '/'
        elif not path:
            path = ""  # enumerate top-of-bucket

        results = list_object_versions(self._bucket, path, recursive=recursive)
        return results

    def fetch(self, key, path):
        """
        Fetches file (or files) at `key` to `path`.

        If `key` ends in '/', then all files with the prefix `key` will match and
        will be stored in a directory at `path`.

        Otherwise, only one file will be fetched and it will be stored at `path`.

        Args:
            key(str): key in bucket to fetch
            path(str): path in local filesystem to store file or files fetched

        Returns:
            None

        Raises:
            * if path doesn't exist
            * if download fails
        """
        source_uri = self._uri + key
        dest_uri = fix_url(path)
        copy_file(source_uri, dest_uri)

    def select(self, key, query, raw=False):
        """
        Selects data from an S3 object.

        Args:
            key(str): key to query in bucket
            query(str): query to execute (SQL by default)
            query_type(str): other query type accepted by S3 service
            raw(bool): return the raw (but parsed) response

        Returns:
            pandas.DataFrame: results of query
        """
        uri = self._uri + key
        return select(uri, query, raw=raw)
