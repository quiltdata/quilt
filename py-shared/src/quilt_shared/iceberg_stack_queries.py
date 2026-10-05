import math
import re
import time
import typing as T

from . import const

# Athena's limits on one statement.
_MAX_QUERY_BYTES = 262_144  # its query string, in UTF-8 bytes
_MAX_PARTITIONS = 100  # partitions it writes


def registry_uri(bucket: str) -> str:
    """The `registry` value of a bucket's rows. Readers compare it whole, so every writer takes it from here."""
    return f"s3://{bucket}"


class Table(T.NamedTuple):
    columns: str
    # Partitioned by `registry`, then by this column hashed into this many buckets.
    hashed: tuple[str, int] | None = None


TABLES = {
    "package_revision": Table(
        "registry STRING, pkg_name STRING, timestamp TIMESTAMP, top_hash STRING",
        ("pkg_name", 8),
    ),
    "package_tag": Table("registry STRING, pkg_name STRING, tag_name STRING, top_hash STRING"),
    "package_manifest": Table(
        "registry STRING, top_hash STRING, message STRING, metadata STRING",
        ("top_hash", 16),
    ),
    "package_entry": Table(
        "registry STRING, top_hash STRING, logical_key STRING, physical_key STRING,"
        " hash_type STRING, hash_value STRING, size BIGINT, metadata STRING",
        ("top_hash", 16),
    ),
}


class Manifest(T.NamedTuple):
    bucket: str
    top_hash: str


class PointerKey(T.NamedTuple):
    bucket: str
    pkg_name: str
    pointer: str  # a revision's timestamp in seconds, or a tag's name


class Pointer(T.NamedTuple):
    bucket: str
    pkg_name: str
    pointer: str
    top_hash: str


class Statement(T.NamedTuple):
    sql: str
    items: tuple  # the items it covers, for retrying them one at a time


def _str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _strs(values: T.Iterable[str]) -> str:
    return ", ".join(_str(v) for v in dict.fromkeys(values))


# The column a pointer table keys a pointer's name on, and how that name is written.
_POINTERS: dict[str, tuple[str, T.Callable[[str], str]]] = {
    "package_revision": ("timestamp", lambda pointer: f"from_unixtime({int(pointer)})"),
    "package_tag": ("tag_name", _str),
}


# A manifest's name under the manifests prefix, in the batch and the fill alike: any other object there is not one.
_TOP_HASH = "[a-z0-9]{64}"


def _named(manifests: T.Iterable[Manifest]) -> list[Manifest]:
    return [m for m in manifests if re.fullmatch(_TOP_HASH, m.top_hash)]


def _manifests_prefix(bucket: str) -> str:
    return f"{registry_uri(bucket)}/{const.MANIFESTS_PREFIX}"


def _manifest_uri(manifest: Manifest) -> str:
    return _manifests_prefix(manifest.bucket) + manifest.top_hash


def _group(items: T.Iterable) -> dict[str, list]:
    groups: dict[str, list] = {}
    for item in dict.fromkeys(items):
        groups.setdefault(item.bucket, []).append(item)
    return groups


def _where_in(prefix: str, column: str, groups: dict[str, list]) -> str:
    # Each registry's own keys, so the scan reads only the partitions they hash to.
    return " OR ".join(
        f"({prefix}registry = {_str(registry_uri(bucket))}"
        f" AND {prefix}{column} IN ({_strs(getattr(i, column) for i in items)}))"
        for bucket, items in groups.items()
    )


def _partitions(table: Table, items: list) -> int:
    if table.hashed is None:
        return 1
    column, buckets = table.hashed
    return min(buckets, len({getattr(i, column) for i in items}))


def _fit(groups: dict[str, list], render: T.Callable[[dict[str, list]], str]) -> list[Statement]:
    sql = render(groups)
    items = [i for group in groups.values() for i in group]
    size = len(sql.encode())
    if len(items) == 1 or size <= _MAX_QUERY_BYTES:
        return [Statement(sql, tuple(items))]
    step = math.ceil(len(items) / math.ceil(size / _MAX_QUERY_BYTES))
    return [s for k in range(0, len(items), step) for s in _fit(_group(items[k : k + step]), render)]


def _statements(
    table: str,
    items: T.Iterable,
    render: T.Callable[[dict[str, list]], str],
) -> list[Statement]:
    chunks: list[dict[str, list]] = []
    chunk: dict[str, list] = {}
    partitions = 0
    for bucket, group in _group(items).items():
        n = _partitions(TABLES[table], group)
        if chunk and partitions + n > _MAX_PARTITIONS:
            chunks.append(chunk)
            chunk, partitions = {}, 0
        chunk[bucket] = group
        partitions += n
    if chunk:
        chunks.append(chunk)
    return [s for c in chunks for s in _fit(c, render)]


class StackQueryMaker:
    """Run a batch's entry upserts before its manifest upserts, and leave out of those any manifest whose
    entries' statement failed: readers take a manifest's row to mean its entries are complete. A batch holds
    each key once, upserted or deleted as its object now stands.
    """

    def __init__(self, *, database: str, user_athena_db: str):
        self.database = database
        self.user_athena_db = user_athena_db

    def _table(self, table: str) -> str:
        return f'"{self.database}"."{table}"'

    def _source(self, bucket: str, table: str) -> str:
        return f'"{self.user_athena_db}"."{bucket}_{table}"'

    def create_table(self, table: str, *, location: str) -> str:
        spec = TABLES[table]
        partitioning = "registry"
        if spec.hashed:
            column, buckets = spec.hashed
            partitioning += f", bucket({buckets}, {column})"
        return f"""
        CREATE TABLE `{self.database}`.`{table}` ({spec.columns})
        PARTITIONED BY ({partitioning})
        LOCATION '{location}'
        TBLPROPERTIES (
            'table_type'='iceberg',
            'format'='PARQUET'
        )
        """

    def _entries_from(self, bucket: str, where: str) -> str:
        return f"""
            SELECT
                {_str(registry_uri(bucket))} AS registry,
                regexp_extract("$path", '[^/]+$') AS top_hash,
                logical_key,
                physical_keys[1] AS physical_key,
                hash.type AS hash_type,
                hash.value AS hash_value,
                size,
                meta AS metadata
            FROM {self._source(bucket, "manifests")}
            WHERE logical_key IS NOT NULL AND {where}
        """

    def _manifests_from(self, bucket: str, where: str) -> str:
        return f"""
            SELECT
                {_str(registry_uri(bucket))} AS registry,
                regexp_extract("$path", '[^/]+$') AS top_hash,
                message,
                user_meta AS metadata
            FROM {self._source(bucket, "manifests")}
            WHERE logical_key IS NULL AND {where}
        """

    def _from_batch(self, select: T.Callable[[str, str], str], groups: dict[str, list[Manifest]]) -> str:
        return "\nUNION ALL\n".join(
            select(bucket, f'"$path" IN ({_strs(map(_manifest_uri, ms))})') for bucket, ms in groups.items()
        )

    def _merge_entries(self, source: str, target: str) -> str:
        return f"""
        MERGE INTO {self._table("package_entry")} AS t
        USING ({source}) AS s
        ON t.registry = s.registry AND t.top_hash = s.top_hash AND t.logical_key = s.logical_key AND ({target})
        WHEN NOT MATCHED THEN
            INSERT (registry, top_hash, logical_key, physical_key, hash_type, hash_value, size, metadata)
            VALUES (s.registry, s.top_hash, s.logical_key,
                s.physical_key, s.hash_type, s.hash_value, s.size, s.metadata)
        """

    def _merge_manifests(self, source: str, target: str) -> str:
        return f"""
        MERGE INTO {self._table("package_manifest")} AS t
        USING ({source}) AS s
        ON t.registry = s.registry AND t.top_hash = s.top_hash AND ({target})
        WHEN NOT MATCHED THEN
            INSERT (registry, top_hash, message, metadata)
            VALUES (s.registry, s.top_hash, s.message, s.metadata)
        """

    def _merge_pointers(self, table: str, rows: str, target: str) -> str:
        column, _ = _POINTERS[table]
        # One source row per pointer, or the MERGE would write or match it twice: two names can spell one
        # timestamp (`0100`, `100`). Only a moved pointer is updated: Athena writes an update as a positional
        # delete beside a new row.
        return f"""
        MERGE INTO {self._table(table)} AS t
        USING (
            SELECT v.registry, v.pkg_name, v.{column}, max(v.top_hash) AS top_hash
            FROM {rows}
            GROUP BY v.registry, v.pkg_name, v.{column}
        ) AS s
        ON t.registry = s.registry AND t.pkg_name = s.pkg_name AND t.{column} = s.{column} AND ({target})
        WHEN MATCHED AND t.top_hash IS DISTINCT FROM s.top_hash THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (registry, pkg_name, {column}, top_hash)
            VALUES (s.registry, s.pkg_name, s.{column}, s.top_hash)
        """

    def _delete(self, table: str, where: str) -> str:
        return f"""
        DELETE FROM {self._table(table)}
        WHERE {where}
        """

    def _upsert_pointers(self, table: str, pointers: T.Iterable[Pointer]) -> list[Statement]:
        column, value = _POINTERS[table]

        def render(groups: dict[str, list[Pointer]]) -> str:
            rows = ", ".join(
                f"({_str(registry_uri(p.bucket))}, {_str(p.pkg_name)}, {value(p.pointer)}, {_str(p.top_hash)})"
                for ps in groups.values()
                for p in ps
            )
            return self._merge_pointers(
                table,
                f"(VALUES {rows}) AS v (registry, pkg_name, {column}, top_hash)",
                _where_in("t.", "pkg_name", groups),
            )

        return _statements(table, pointers, render)

    def _delete_pointers(self, table: str, pointers: T.Iterable[PointerKey]) -> list[Statement]:
        column, value = _POINTERS[table]

        def render(groups: dict[str, list[PointerKey]]) -> str:
            return self._delete(
                table,
                " OR ".join(
                    f"(registry = {_str(registry_uri(bucket))} AND ("
                    + " OR ".join(f"(pkg_name = {_str(p.pkg_name)} AND {column} = {value(p.pointer)})" for p in ps)
                    + "))"
                    for bucket, ps in groups.items()
                ),
            )

        return _statements(table, pointers, render)

    def _delete_manifests(self, table: str, manifests: T.Iterable[Manifest]) -> list[Statement]:
        return _statements(table, manifests, lambda groups: self._delete(table, _where_in("", "top_hash", groups)))

    def entry_upsert(self, manifests: T.Iterable[Manifest]) -> list[Statement]:
        return _statements(
            "package_entry",
            _named(manifests),
            lambda groups: self._merge_entries(
                self._from_batch(self._entries_from, groups), _where_in("t.", "top_hash", groups)
            ),
        )

    def manifest_upsert(self, manifests: T.Iterable[Manifest]) -> list[Statement]:
        return _statements(
            "package_manifest",
            _named(manifests),
            lambda groups: self._merge_manifests(
                self._from_batch(self._manifests_from, groups), _where_in("t.", "top_hash", groups)
            ),
        )

    def revision_upsert(self, pointers: T.Iterable[Pointer]) -> list[Statement]:
        return self._upsert_pointers("package_revision", pointers)

    def tag_upsert(self, pointers: T.Iterable[Pointer]) -> list[Statement]:
        return self._upsert_pointers("package_tag", pointers)

    def revision_delete(self, pointers: T.Iterable[PointerKey]) -> list[Statement]:
        return self._delete_pointers("package_revision", pointers)

    def tag_delete(self, pointers: T.Iterable[PointerKey]) -> list[Statement]:
        return self._delete_pointers("package_tag", pointers)

    def manifest_delete(self, manifests: T.Iterable[Manifest]) -> list[Statement]:
        return self._delete_manifests("package_manifest", manifests)

    def entry_delete(self, manifests: T.Iterable[Manifest]) -> list[Statement]:
        return self._delete_manifests("package_entry", manifests)

    def fill(self, bucket: str, *, written_before: float | None = None) -> list[str]:
        """Inserts what the set lacks of a bucket's packages and updates the pointers that moved; run the first
        statement, its entries, before the second, its manifests."""
        registry = _str(registry_uri(bucket))
        target = f"t.registry = {registry}"
        # Both read the same manifests, so one written between them gets neither its entries nor its row here: its
        # event, or the next fill, writes both. S3 reports modification times in whole seconds, so the cutoff is
        # the start of the second the fill was built in, which no manifest written after the build precedes.
        cutoff = int(time.time() if written_before is None else written_before)
        manifest_files = (
            f"""regexp_like(substr("$path", {len(_manifests_prefix(bucket)) + 1}), '^{_TOP_HASH}$')"""
            f""" AND "$file_modified_time" < from_unixtime({cutoff})"""
        )
        # NULL in Athena, empty elsewhere, for a path that names no package; either fails `<> ''`.
        pkg_name = """regexp_extract("$path", '^s3://[^/]+/[^/]+/[^/]+/([^/]+/[^/]+)/[^/]+$', 1)"""
        pointer = """regexp_extract("$path", '[^/]+$')"""
        packages = self._source(bucket, "packages")
        revisions = f"""(
            SELECT
                {registry} AS registry,
                {pkg_name} AS pkg_name,
                from_unixtime(CAST({pointer} AS bigint)) AS timestamp,
                top_hash
            FROM {packages}
            WHERE TRY_CAST({pointer} AS bigint) IS NOT NULL AND {pkg_name} <> ''
        ) AS v"""
        tags = f"""(
            SELECT
                {registry} AS registry,
                {pkg_name} AS pkg_name,
                {pointer} AS tag_name,
                top_hash
            FROM {packages}
            WHERE TRY_CAST({pointer} AS bigint) IS NULL AND {pkg_name} <> ''
        ) AS v"""
        return [
            self._merge_entries(self._entries_from(bucket, manifest_files), target),
            self._merge_manifests(self._manifests_from(bucket, manifest_files), target),
            self._merge_pointers("package_revision", revisions, target),
            self._merge_pointers("package_tag", tags, target),
        ]

    def remove(self, bucket: str) -> list[str]:
        registry = _str(registry_uri(bucket))
        return [
            self._delete(table, f"registry = {registry}")
            for table in ("package_tag", "package_revision", "package_manifest", "package_entry")
        ]
