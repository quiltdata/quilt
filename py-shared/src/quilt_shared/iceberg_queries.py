import typing as T

from . import const


class QueryMaker:
    def __init__(self, *, user_athena_db: str):
        self.user_athena_db = user_athena_db

    def package_revision_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO package_revision AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                regexp_extract("$path", '^s3://[^/]+/[^/]+/[^/]+/([^/]+/[^/]+)', 1) AS pkg_name,
                from_unixtime(CAST(regexp_extract("$path", '[^/]+$') AS bigint)) AS timestamp,
                top_hash
            FROM "{self.user_athena_db}"."{bucket}_packages"
            WHERE TRY_CAST(regexp_extract("$path", '[^/]+$') AS bigint) IS NOT NULL
        ) AS s
        ON t.bucket = s.bucket AND t.pkg_name = s.pkg_name AND t.timestamp = s.timestamp
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (bucket, pkg_name, timestamp, top_hash)
            VALUES (s.bucket, s.pkg_name, s.timestamp, s.top_hash)
        """

    def package_revision_add_single(self, *, bucket: str, pkg_name: str, pointer: str, top_hash: str) -> str:
        return f"""
        MERGE INTO package_revision AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                '{pkg_name}' AS pkg_name,
                from_unixtime({pointer}) AS timestamp,
                '{top_hash}' AS top_hash
        ) AS s
        ON t.bucket = s.bucket AND t.pkg_name = s.pkg_name AND t.timestamp = s.timestamp
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (bucket, pkg_name, timestamp, top_hash)
            VALUES (s.bucket, s.pkg_name, s.timestamp, s.top_hash)
        """

    def package_revision_delete_bucket(self, *, bucket: str) -> str:
        return f"""
        DELETE FROM package_revision
        WHERE bucket = '{bucket}'
        """

    def package_revision_delete_single(self, *, bucket: str, pkg_name: str, pointer: str) -> str:
        return f"""
        DELETE FROM package_revision
        WHERE bucket = '{bucket}' AND pkg_name = '{pkg_name}' AND timestamp = from_unixtime({pointer})
        """

    def package_tag_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO package_tag AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                regexp_extract("$path", '^s3://[^/]+/[^/]+/[^/]+/([^/]+/[^/]+)', 1) AS pkg_name,
                regexp_extract("$path", '[^/]+$') AS tag_name,
                top_hash
            FROM "{self.user_athena_db}"."{bucket}_packages"
            WHERE TRY_CAST(regexp_extract("$path", '[^/]+$') AS bigint) IS NULL
        ) AS s
        ON t.bucket = s.bucket AND t.pkg_name = s.pkg_name AND t.tag_name = s.tag_name
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (bucket, pkg_name, tag_name, top_hash)
            VALUES (s.bucket, s.pkg_name, s.tag_name, s.top_hash)
        """

    def package_tag_add_single(self, *, bucket: str, pkg_name: str, pointer: str, top_hash: str) -> str:
        return f"""
        MERGE INTO package_tag AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                '{pkg_name}' AS pkg_name,
                '{pointer}' AS tag_name,
                '{top_hash}' AS top_hash
        ) AS s
        ON t.bucket = s.bucket AND t.pkg_name = s.pkg_name AND t.tag_name = s.tag_name
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (bucket, pkg_name, tag_name, top_hash)
            VALUES (s.bucket, s.pkg_name, s.tag_name, s.top_hash)
        """

    def package_tag_delete_bucket(self, *, bucket: str) -> str:
        return f"""
        DELETE FROM package_tag
        WHERE bucket = '{bucket}'
        """

    def package_tag_delete_single(self, *, bucket: str, pkg_name: str, pointer: str) -> str:
        return f"""
        DELETE FROM package_tag
        WHERE bucket = '{bucket}' AND pkg_name = '{pkg_name}' AND tag_name = '{pointer}'
        """

    def package_manifest_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO package_manifest AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                regexp_extract("$path", '[^/]+$') AS top_hash,
                message,
                user_meta AS metadata
            FROM "{self.user_athena_db}"."{bucket}_manifests"
            WHERE logical_key IS NULL
                -- filter out bogus manifests i.e. parquet files
                AND regexp_extract("$path", '/[a-z0-9]{64}$')
        ) AS s
        ON t.bucket = s.bucket AND t.top_hash = s.top_hash
        WHEN MATCHED THEN
            UPDATE SET message = s.message, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (bucket, top_hash, message, metadata)
            VALUES (s.bucket, s.top_hash, s.message, s.metadata)
        """

    def package_manifest_add_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        MERGE INTO package_manifest AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                regexp_extract("$path", '[^/]+$') AS top_hash,
                message,
                user_meta AS metadata
            FROM "{self.user_athena_db}"."{bucket}_manifests"
            WHERE logical_key IS NULL
                AND "$path" = 's3://{bucket}/{const.MANIFESTS_PREFIX}{top_hash}'
        ) AS s
        ON t.bucket = s.bucket AND t.top_hash = s.top_hash
        WHEN MATCHED THEN
            UPDATE SET message = s.message, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (bucket, top_hash, message, metadata)
            VALUES (s.bucket, s.top_hash, s.message, s.metadata)
        """

    def package_manifest_delete_bucket(self, *, bucket: str) -> str:
        return f"""
        DELETE FROM package_manifest
        WHERE bucket = '{bucket}'
        """

    def package_manifest_delete_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        DELETE FROM package_manifest
        WHERE bucket = '{bucket}' AND top_hash = '{top_hash}'
        """

    def package_entry_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO package_entry AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                regexp_extract("$path", '[^/]+$') AS top_hash,
                logical_key,
                physical_keys[1] AS physical_key,
                hash.type AS hash_type,
                hash.value AS hash_value,
                size,
                meta AS metadata
            FROM "{self.user_athena_db}"."{bucket}_manifests"
            WHERE logical_key IS NOT NULL
                -- filter out bogus manifests i.e. parquet files
                AND regexp_extract("$path", '/[a-z0-9]{64}$')
        ) AS s
        ON t.bucket = s.bucket AND t.top_hash = s.top_hash AND t.logical_key = s.logical_key
        WHEN MATCHED THEN
            UPDATE SET physical_key = s.physical_key, hash_type = s.hash_type, hash_value = s.hash_value,
                size = s.size, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (bucket, top_hash, logical_key, physical_key, hash_type, hash_value, size, metadata)
            VALUES (s.bucket, s.top_hash, s.logical_key,
                s.physical_key, s.hash_type, s.hash_value, s.size, s.metadata)
        """

    def package_entry_add_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        MERGE INTO package_entry AS t
        USING (
            SELECT
                '{bucket}' AS bucket,
                regexp_extract("$path", '[^/]+$') AS top_hash,
                logical_key,
                physical_keys[1] AS physical_key,
                hash.type AS hash_type,
                hash.value AS hash_value,
                size,
                meta AS metadata
            FROM "{self.user_athena_db}"."{bucket}_manifests"
            WHERE logical_key IS NOT NULL
                AND "$path" = 's3://{bucket}/{const.MANIFESTS_PREFIX}{top_hash}'
        ) AS s
        ON t.bucket = s.bucket AND t.top_hash = s.top_hash AND t.logical_key = s.logical_key
        WHEN MATCHED THEN
            UPDATE SET physical_key = s.physical_key, hash_type = s.hash_type, hash_value = s.hash_value,
                size = s.size, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (bucket, top_hash, logical_key, physical_key, hash_type, hash_value, size, metadata)
            VALUES (s.bucket, s.top_hash, s.logical_key,
                s.physical_key, s.hash_type, s.hash_value, s.size, s.metadata)
        """

    def package_entry_delete_bucket(self, *, bucket: str) -> str:
        return f"""
        DELETE FROM package_entry
        WHERE bucket = '{bucket}'
        """

    def package_entry_delete_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        DELETE FROM package_entry
        WHERE bucket = '{bucket}' AND top_hash = '{top_hash}'
        """
