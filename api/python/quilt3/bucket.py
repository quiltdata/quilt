"""
bucket.py

Contains the Bucket class, which provides several useful functions
    over an s3 bucket.
"""
import pathlib

from .data_transfer import (
    copy_file,
    delete_object,
    list_object_versions,
    list_objects,
    select,
)
from .search_util import search_api
from .util import PhysicalKey, QuiltException, fix_url


class Bucket:
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
        self._pk = PhysicalKey.from_url(bucket_uri)
        if self._pk.is_local():
            raise QuiltException("Bucket URI must be an S3 URI")
        if self._pk.path or self._pk.version_id is not None:
            raise QuiltException("Bucket URI shouldn't contain a path or a version ID")

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
        return search_api(query, index=self._pk.bucket, limit=limit)

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
        dest = self._pk.join(key)
        copy_file(PhysicalKey.from_url(fix_url(path)), dest)

    def put_dir(self, key, directory):
        """
        Stores all files in the `directory` under the prefix `key`.

        Args:
            key(str): prefix to store files under in bucket
            directory(str): path to directory to grab files from

        Returns:
            None

        Raises:
            * if writing to bucket fails
        """
        # Ensure key ends in '/'.
        if key and key[-1] != '/':
            key += '/'

        src_path = pathlib.Path(directory)
        if not src_path.is_dir():
            raise QuiltException("Provided directory does not exist")

        src = PhysicalKey.from_path(str(src_path) + '/')
        dest = self._pk.join(key)
        copy_file(src, dest)

    def keys(self):
        """
        Lists all keys in the bucket.

        Returns:
            List of strings
        """
        return [x.get('Key') for x in list_objects(self._pk.bucket, '')]

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

        delete_object(self._pk.bucket, key)

    def delete_dir(self, path):
        """Delete a directory and all of its contents from the bucket.

        Parameters:
                path (str): path to the directory to delete
        """
        results = list_objects(self._pk.bucket, path)
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

        results = list_object_versions(self._pk.bucket, path, recursive=recursive)
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
        source = self._pk.join(key)
        dest = PhysicalKey.from_url(fix_url(path))
        copy_file(source, dest)

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
        source = self._pk.join(key)
        return select(source, query, raw=raw)
