import typing as T

from . import const


class QueryMaker:
    def __init__(self, *, user_athena_db: str):
        self.user_athena_db = user_athena_db

    @staticmethod
    def _table(bucket: str, table: str) -> str:
        # Per-bucket table name in IcebergDatabase. Raw bucket name (no
        # sanitization), quoted at the call site.
        return f"{bucket}_{table}"

    def package_revision_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_revision")}" AS t
        USING (
            SELECT
                regexp_extract("$path", '^s3://[^/]+/[^/]+/[^/]+/([^/]+/[^/]+)', 1) AS pkg_name,
                from_unixtime(CAST(regexp_extract("$path", '[^/]+$') AS bigint)) AS timestamp,
                top_hash
            FROM "{self.user_athena_db}"."{bucket}_packages"
            WHERE TRY_CAST(regexp_extract("$path", '[^/]+$') AS bigint) IS NOT NULL
        ) AS s
        ON t.pkg_name = s.pkg_name AND t.timestamp = s.timestamp
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (pkg_name, timestamp, top_hash)
            VALUES (s.pkg_name, s.timestamp, s.top_hash)
        """

    def package_revision_add_single(self, *, bucket: str, pkg_name: str, pointer: str, top_hash: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_revision")}" AS t
        USING (
            SELECT
                '{pkg_name}' AS pkg_name,
                from_unixtime({pointer}) AS timestamp,
                '{top_hash}' AS top_hash
        ) AS s
        ON t.pkg_name = s.pkg_name AND t.timestamp = s.timestamp
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (pkg_name, timestamp, top_hash)
            VALUES (s.pkg_name, s.timestamp, s.top_hash)
        """

    def package_revision_delete_single(self, *, bucket: str, pkg_name: str, pointer: str) -> str:
        return f"""
        DELETE FROM "{self._table(bucket, "package_revision")}"
        WHERE pkg_name = '{pkg_name}' AND timestamp = from_unixtime({pointer})
        """

    def package_tag_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_tag")}" AS t
        USING (
            SELECT
                regexp_extract("$path", '^s3://[^/]+/[^/]+/[^/]+/([^/]+/[^/]+)', 1) AS pkg_name,
                regexp_extract("$path", '[^/]+$') AS tag_name,
                top_hash
            FROM "{self.user_athena_db}"."{bucket}_packages"
            WHERE TRY_CAST(regexp_extract("$path", '[^/]+$') AS bigint) IS NULL
        ) AS s
        ON t.pkg_name = s.pkg_name AND t.tag_name = s.tag_name
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (pkg_name, tag_name, top_hash)
            VALUES (s.pkg_name, s.tag_name, s.top_hash)
        """

    def package_tag_add_single(self, *, bucket: str, pkg_name: str, pointer: str, top_hash: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_tag")}" AS t
        USING (
            SELECT
                '{pkg_name}' AS pkg_name,
                '{pointer}' AS tag_name,
                '{top_hash}' AS top_hash
        ) AS s
        ON t.pkg_name = s.pkg_name AND t.tag_name = s.tag_name
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (pkg_name, tag_name, top_hash)
            VALUES (s.pkg_name, s.tag_name, s.top_hash)
        """

    def package_tag_delete_single(self, *, bucket: str, pkg_name: str, pointer: str) -> str:
        return f"""
        DELETE FROM "{self._table(bucket, "package_tag")}"
        WHERE pkg_name = '{pkg_name}' AND tag_name = '{pointer}'
        """

    def package_manifest_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_manifest")}" AS t
        USING (
            SELECT
                regexp_extract("$path", '[^/]+$') AS top_hash,
                message,
                user_meta AS metadata
            FROM "{self.user_athena_db}"."{bucket}_manifests"
            WHERE logical_key IS NULL
                -- filter out bogus manifests i.e. parquet files
                AND regexp_like("$path", '/[a-z0-9]{{64}}$')
        ) AS s
        ON t.top_hash = s.top_hash
        WHEN MATCHED THEN
            UPDATE SET message = s.message, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (top_hash, message, metadata)
            VALUES (s.top_hash, s.message, s.metadata)
        """

    def package_manifest_add_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_manifest")}" AS t
        USING (
            SELECT
                regexp_extract("$path", '[^/]+$') AS top_hash,
                message,
                user_meta AS metadata
            FROM "{self.user_athena_db}"."{bucket}_manifests"
            WHERE logical_key IS NULL
                AND "$path" = 's3://{bucket}/{const.MANIFESTS_PREFIX}{top_hash}'
        ) AS s
        ON t.top_hash = s.top_hash
        WHEN MATCHED THEN
            UPDATE SET message = s.message, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (top_hash, message, metadata)
            VALUES (s.top_hash, s.message, s.metadata)
        """

    def package_manifest_delete_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        DELETE FROM "{self._table(bucket, "package_manifest")}"
        WHERE top_hash = '{top_hash}'
        """

    def package_entry_add_bucket(self, *, bucket: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_entry")}" AS t
        USING (
            SELECT
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
                AND regexp_like("$path", '/[a-z0-9]{{64}}$')
        ) AS s
        ON t.top_hash = s.top_hash AND t.logical_key = s.logical_key
        WHEN MATCHED THEN
            UPDATE SET physical_key = s.physical_key, hash_type = s.hash_type, hash_value = s.hash_value,
                size = s.size, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (top_hash, logical_key, physical_key, hash_type, hash_value, size, metadata)
            VALUES (s.top_hash, s.logical_key,
                s.physical_key, s.hash_type, s.hash_value, s.size, s.metadata)
        """

    def package_entry_add_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        MERGE INTO "{self._table(bucket, "package_entry")}" AS t
        USING (
            SELECT
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
        ON t.top_hash = s.top_hash AND t.logical_key = s.logical_key
        WHEN MATCHED THEN
            UPDATE SET physical_key = s.physical_key, hash_type = s.hash_type, hash_value = s.hash_value,
                size = s.size, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (top_hash, logical_key, physical_key, hash_type, hash_value, size, metadata)
            VALUES (s.top_hash, s.logical_key,
                s.physical_key, s.hash_type, s.hash_value, s.size, s.metadata)
        """

    def package_entry_delete_single(self, *, bucket: str, top_hash: str) -> str:
        return f"""
        DELETE FROM "{self._table(bucket, "package_entry")}"
        WHERE top_hash = '{top_hash}'
        """
