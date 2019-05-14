"""
bucket.py

Contains the Bucket class, which provides several useful functions
    over an s3 bucket.
"""
import pathlib
from urllib.parse import urlparse

from .data_transfer import (copy_file, copy_object, delete_object, get_bytes,
                            get_size_and_meta, list_object_versions,
                            list_objects, put_bytes, select)
from .formats import FormatRegistry
from .search_util import get_search_schema, search
from .util import QuiltException, find_bucket_config, fix_url, get_from_config, parse_s3_url


class Bucket(object):
    """Bucket interface for Quilt3.
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
                raise QuiltException("Must set `quilt3.config(navigator_url)`, where `navigator_url` is the URL "
                                     "of your catalog homepage.")

            navigator_url.rstrip('/') # remove trailing / if present
            config_url = navigator_url + '/config.json'

        bucket_config = find_bucket_config(self._bucket, config_url)
        if 'searchEndpoint' in bucket_config:
            self._search_endpoint = bucket_config['searchEndpoint']
        elif 'search_endpoint' in bucket_config:
            # old format
            self._search_endpoint = bucket_config['search_endpoint']
        # TODO: we can maybe get this from searchEndpoint or apiGatewayEndpoint
        self._region = bucket_config.get('region', 'us-east-1')

    def get_user_meta_schema(self):
        """
        Returns the current search mappings for user metadata from the search endpoint.
        """
        if not self._search_endpoint or not self._region:
            self.config()
        schema = get_search_schema(self._search_endpoint, self._region)
        return schema['user_meta']

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
            either the request object (in case of an error) or
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
        if not self._search_endpoint:
            self.config()
        if self._region:
            return search(
                query, self._search_endpoint, limit=limit, aws_region=self._region)
        return search(query, self._search_endpoint, limit=limit)

    def deserialize(self, key):
        """
        Deserializes object at key from bucket.

        Args:
            key(str): key in bucket to get

        Returns:
            Deserialized object.

        Raises:
            KeyError: if key does not exist
            QuiltException: if deserialization fails in a known way
            * if a deserializer raises an unexpected error
        """
        data, meta = get_bytes(self._uri + key)
        return FormatRegistry.deserialize(data, meta, pathlib.PurePosixPath(key).suffix)

    def __call__(self, key):
        """Deserializes object at key from bucket. Syntactic sugar for `bucket.deserialize(key)`.

        Args:
            key: Key of object to deserialize.
        """
        return self.deserialize(key)

    def put(self, key, obj, meta=None):
        """
        Stores `obj` at key in bucket, optionally with user-provided metadata.

        Args:
            key(str): key in bucket to put object to
            obj(serializable): serializable object to store at key
            meta(dict): optional user-provided metadata to store
        """
        user_meta = meta or {}
        dest = self._uri + key
        ext = pathlib.PurePosixPath(key).suffix
        all_meta = {
            'user_meta': user_meta,
        }
        
        data, format_meta = FormatRegistry.serialize(obj, all_meta, ext)
        all_meta.update(format_meta)

        put_bytes(data, dest, all_meta)

    def put_file(self, key, path, meta=None):
        """
        Stores file at path to key in bucket.

        Args:
            key(str): key in bucket to store file at
            path(str): string representing local path to file
        Optional args:
            meta(dict): Quilt3 metadata to attach to file
                Must be less than 2KiB serialized

        Returns:
            None

        Raises:
            * if no file exists at path
            * if copy fails
        """
        user_meta = meta or {}
        dest = self._uri + key
        all_meta = {
            'user_meta': user_meta,
        }
        copy_file(fix_url(path), dest, all_meta)

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

    def get_meta(self, key):
        """
        Gets the metadata associated with a `key` in the bucket.

        Args:
            key(str): key in bucket to get meta for

        Returns:
            dict of meta

        Raises:
            * if download fails
        """
        src_uri = self._uri + key
        return get_size_and_meta(src_uri)[1]

    def set_meta(self, key, meta):
        """
        Sets user metadata on a `key` in the bucket.

        Args:
            key(str): key in bucket to set meta for
            meta(dict): value to set user metadata to

        Returns:
            None

        Raises:
            * if put to bucket fails
        """
        existing_meta = self.get_meta(key)
        existing_meta['user_meta'] = meta
        copy_object(self._bucket, key, self._bucket, key, existing_meta)

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
        meta = self.get_meta(key)
        uri = self._uri + key
        return select(uri, query, meta=meta, raw=raw)
