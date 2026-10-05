import datetime

import duckdb
import pytest

from quilt_shared.iceberg_stack_queries import (
    TABLES,
    Manifest,
    Pointer,
    PointerKey,
    StackQueryMaker,
    registry_uri,
)

DB = "quilt__test"
USER_DB = "userdb"
BUCKETS = ("b1", "b2")
MAX_QUERY_BYTES = 262_144  # Athena's limit on one query string, in UTF-8 bytes
MAX_PARTITIONS = 100  # Athena's limit on partitions written by one statement


@pytest.fixture
def qm():
    return StackQueryMaker(database=DB, user_athena_db=USER_DB)


@pytest.fixture
def con():
    """The set's tables beside the user Athena database's tables over each bucket's manifests and pointers."""
    con = duckdb.connect()
    # Athena's spelling of what DuckDB names otherwise.
    con.execute("CREATE MACRO from_unixtime(x) AS make_timestamp(CAST(x AS BIGINT) * 1000000)")
    con.execute("CREATE MACRO regexp_like(s, p) AS regexp_matches(s, p)")
    con.execute(f"CREATE SCHEMA {DB}")
    con.execute(f"CREATE SCHEMA {USER_DB}")
    for name, table in TABLES.items():
        con.execute(f'CREATE TABLE "{DB}"."{name}" ({table.columns})')
    for bucket in BUCKETS:
        con.execute(
            f'CREATE TABLE "{USER_DB}"."{bucket}_manifests" ("$path" VARCHAR, logical_key VARCHAR,'
            " physical_keys VARCHAR[], hash STRUCT(type VARCHAR, value VARCHAR), size BIGINT, meta VARCHAR,"
            " message VARCHAR, user_meta VARCHAR)"
        )
        con.execute(f'CREATE TABLE "{USER_DB}"."{bucket}_packages" ("$path" VARCHAR, top_hash VARCHAR)')
    return con


def h(n: int) -> str:
    return f"{n:064x}"


def push_manifest(con, bucket: str, top_hash: str, keys=("a.txt",)):
    path = f"s3://{bucket}/.quilt/packages/{top_hash}"
    con.execute(
        f'INSERT INTO "{USER_DB}"."{bucket}_manifests" VALUES (?, NULL, NULL, NULL, NULL, NULL, ?, ?)',
        [path, f"msg {top_hash}", '{"k": 1}'],
    )
    for key in keys:
        con.execute(
            f'INSERT INTO "{USER_DB}"."{bucket}_manifests" VALUES (?, ?, ?, ?, 7, ?, NULL, NULL)',
            [path, key, [f"s3://{bucket}/{key}?versionId=v"], {"type": "SHA256", "value": "x"}, "{}"],
        )


def push_pointer(con, bucket: str, pkg_name: str, pointer: str, top_hash: str):
    con.execute(
        f'INSERT INTO "{USER_DB}"."{bucket}_packages" VALUES (?, ?)',
        [f"s3://{bucket}/.quilt/named_packages/{pkg_name}/{pointer}", top_hash],
    )


def insert(con, table: str, *rows):
    for row in rows:
        con.execute(f'INSERT INTO "{DB}"."{table}" VALUES ({", ".join("?" * len(row))})', list(row))


def run(con, statements) -> list[int]:
    """Runs statements in order, returning the rows each wrote."""
    return [con.execute(s if isinstance(s, str) else s.sql).fetchone()[0] for s in statements]


def rows(con, table: str, *columns: str) -> list[tuple]:
    return sorted(con.execute(f'SELECT {", ".join(columns) or "*"} FROM "{DB}"."{table}"').fetchall())


def entry(bucket: str, top_hash: str, key: str = "a.txt") -> tuple:
    return (f"s3://{bucket}", top_hash, key, f"s3://{bucket}/{key}?versionId=v", "SHA256", "x", 7, "{}")


def ts(seconds: int) -> datetime.datetime:
    return datetime.datetime(1970, 1, 1) + datetime.timedelta(seconds=seconds)


def test_registry_uri_is_the_bucket_under_the_s3_scheme_without_a_trailing_slash():
    assert registry_uri("my-bucket") == "s3://my-bucket"


# The per-bucket tables' columns with `registry` added first, and each table's partitioning.
SCHEMA = {
    "package_revision": (
        ["registry STRING", "pkg_name STRING", "timestamp TIMESTAMP", "top_hash STRING"],
        "registry, bucket(8, pkg_name)",
    ),
    "package_tag": (
        ["registry STRING", "pkg_name STRING", "tag_name STRING", "top_hash STRING"],
        "registry",
    ),
    "package_manifest": (
        ["registry STRING", "top_hash STRING", "message STRING", "metadata STRING"],
        "registry, bucket(16, top_hash)",
    ),
    "package_entry": (
        [
            "registry STRING",
            "top_hash STRING",
            "logical_key STRING",
            "physical_key STRING",
            "hash_type STRING",
            "hash_value STRING",
            "size BIGINT",
            "metadata STRING",
        ],
        "registry, bucket(16, top_hash)",
    ),
}


@pytest.mark.parametrize("table", SCHEMA)
def test_create_table_is_an_iceberg_parquet_table_of_the_per_bucket_columns_keyed_by_registry(qm, table):
    """A structural test: the schema is the contract product views are written against."""
    columns, partitioning = SCHEMA[table]

    sql = qm.create_table(table, location=f"s3://svc/set/{table}/")

    assert " ".join(sql.split()) == (
        f"CREATE TABLE `{DB}`.`{table}` ({', '.join(columns)}) PARTITIONED BY ({partitioning})"
        f" LOCATION 's3://svc/set/{table}/' TBLPROPERTIES ( 'table_type'='iceberg', 'format'='PARQUET' )"
    )


def test_entry_upsert_inserts_the_batch_manifests_entries_across_buckets(qm, con):
    push_manifest(con, "b1", h(1), keys=("a.txt", "b.txt"))
    push_manifest(con, "b1", h(3))
    push_manifest(con, "b2", h(2))

    statements = qm.entry_upsert([Manifest("b1", h(1)), Manifest("b2", h(2))])

    assert len(statements) == 1
    run(con, statements)
    assert rows(con, "package_entry") == sorted(
        [entry("b1", h(1), "a.txt"), entry("b1", h(1), "b.txt"), entry("b2", h(2))]
    )


def test_entry_upsert_inserts_only_absent_rows(qm, con):
    push_manifest(con, "b1", h(1), keys=("a.txt", "b.txt"))
    stale = (*entry("b1", h(1), "a.txt")[:-1], "stale")
    insert(con, "package_entry", stale)

    assert run(con, qm.entry_upsert([Manifest("b1", h(1))])) == [1]
    assert run(con, qm.entry_upsert([Manifest("b1", h(1))])) == [0]
    assert rows(con, "package_entry") == sorted([stale, entry("b1", h(1), "b.txt")])


def test_upserts_write_nothing_for_an_object_under_the_manifests_prefix_that_is_not_a_manifest(qm, con):
    batch = [Manifest("b1", f"sub/{h(1)}"), Manifest("b1", f"{h(2)}.parquet")]
    for m in batch:
        push_manifest(con, m.bucket, m.top_hash)

    for _ in range(2):
        run(con, qm.entry_upsert(batch) + qm.manifest_upsert(batch))

    assert rows(con, "package_entry") == []
    assert rows(con, "package_manifest") == []


def test_manifest_upsert_inserts_the_batch_manifests_across_buckets(qm, con):
    push_manifest(con, "b1", h(1))
    push_manifest(con, "b1", h(3))
    push_manifest(con, "b2", h(2))

    run(con, qm.manifest_upsert([Manifest("b1", h(1)), Manifest("b2", h(2))]))

    assert rows(con, "package_manifest") == [
        ("s3://b1", h(1), f"msg {h(1)}", '{"k": 1}'),
        ("s3://b2", h(2), f"msg {h(2)}", '{"k": 1}'),
    ]


def test_manifest_upsert_inserts_only_absent_rows(qm, con):
    push_manifest(con, "b1", h(1))
    push_manifest(con, "b1", h(2))
    insert(con, "package_manifest", ("s3://b1", h(1), "stale", "{}"))
    batch = [Manifest("b1", h(1)), Manifest("b1", h(2))]

    assert run(con, qm.manifest_upsert(batch)) == [1]
    assert run(con, qm.manifest_upsert(batch)) == [0]
    assert rows(con, "package_manifest", "registry", "top_hash", "message") == [
        ("s3://b1", h(1), "stale"),
        ("s3://b1", h(2), f"msg {h(2)}"),
    ]


def test_revision_upsert_writes_the_batch_revisions_across_buckets_whether_or_not_their_manifest_is_in_the_set(
    qm, con
):
    insert(con, "package_manifest", ("s3://b1", h(1), "", "{}"))

    run(con, qm.revision_upsert([Pointer("b1", "u/p", "100", h(1)), Pointer("b2", "u/q", "300", h(2))]))

    assert rows(con, "package_revision") == [
        ("s3://b1", "u/p", ts(100), h(1)),
        ("s3://b2", "u/q", ts(300), h(2)),
    ]


def test_revision_upsert_moves_a_rewritten_revision_and_writes_nothing_for_an_unchanged_one(qm, con):
    insert(con, "package_revision", ("s3://b1", "u/p", ts(100), h(1)))
    batch = [Pointer("b1", "u/p", "100", h(2)), Pointer("b1", "u/p", "200", h(2))]

    assert run(con, qm.revision_upsert(batch)) == [2]
    assert run(con, qm.revision_upsert(batch)) == [0]
    assert rows(con, "package_revision") == [
        ("s3://b1", "u/p", ts(100), h(2)),
        ("s3://b1", "u/p", ts(200), h(2)),
    ]


def test_tag_upsert_writes_the_batch_tags_across_buckets_whether_or_not_their_manifest_is_in_the_set(qm, con):
    insert(con, "package_manifest", ("s3://b1", h(1), "", "{}"))

    run(con, qm.tag_upsert([Pointer("b1", "u/p", "latest", h(1)), Pointer("b2", "u/q", "v1", h(2))]))

    assert rows(con, "package_tag") == [
        ("s3://b1", "u/p", "latest", h(1)),
        ("s3://b2", "u/q", "v1", h(2)),
    ]


def test_tag_upsert_moves_a_moved_tag_and_writes_nothing_for_an_unmoved_one(qm, con):
    insert(con, "package_tag", ("s3://b1", "u/p", "latest", h(1)))

    assert run(con, qm.tag_upsert([Pointer("b1", "u/p", "latest", h(2))])) == [1]
    assert run(con, qm.tag_upsert([Pointer("b1", "u/p", "latest", h(2))])) == [0]
    assert rows(con, "package_tag") == [("s3://b1", "u/p", "latest", h(2))]


def test_revision_upsert_writes_one_row_for_a_timestamp_two_pointer_names_spell(qm, con):
    batch = [Pointer("b1", "u/p", "0100", h(1)), Pointer("b1", "u/p", "100", h(2))]

    statements = qm.revision_upsert(batch)
    run(con, statements)

    assert rows(con, "package_revision", "pkg_name", "timestamp", "top_hash") == [("u/p", ts(100), h(2))]
    assert sorted(i for s in statements for i in s.items) == sorted(batch)


def test_revision_delete_removes_only_the_given_revisions(qm, con):
    insert(
        con,
        "package_revision",
        ("s3://b1", "u/p", ts(100), h(1)),
        ("s3://b1", "u/p", ts(200), h(1)),
        ("s3://b2", "u/p", ts(100), h(1)),
    )

    run(con, qm.revision_delete([PointerKey("b1", "u/p", "100")]))

    assert rows(con, "package_revision", "registry", "timestamp") == [("s3://b1", ts(200)), ("s3://b2", ts(100))]


def test_tag_delete_removes_only_the_given_tags(qm, con):
    insert(
        con,
        "package_tag",
        ("s3://b1", "u/p", "latest", h(1)),
        ("s3://b1", "u/p", "v1", h(1)),
        ("s3://b2", "u/p", "latest", h(1)),
    )

    run(con, qm.tag_delete([PointerKey("b1", "u/p", "latest")]))

    assert rows(con, "package_tag", "registry", "tag_name") == [("s3://b1", "v1"), ("s3://b2", "latest")]


def test_manifest_and_entry_deletes_remove_only_the_given_manifests_rows(qm, con):
    for bucket, top_hash in [("b1", h(1)), ("b1", h(2)), ("b2", h(1))]:
        insert(con, "package_manifest", (f"s3://{bucket}", top_hash, "", "{}"))
        insert(con, "package_entry", entry(bucket, top_hash))

    run(con, qm.manifest_delete([Manifest("b1", h(1))]) + qm.entry_delete([Manifest("b1", h(1))]))

    remaining = [("s3://b1", h(2)), ("s3://b2", h(1))]
    assert rows(con, "package_manifest", "registry", "top_hash") == remaining
    assert rows(con, "package_entry", "registry", "top_hash") == remaining


def push_bucket(con):
    push_manifest(con, "b1", h(1))
    push_manifest(con, "b1", h(2))
    push_pointer(con, "b1", "u/p", "100", h(1))
    push_pointer(con, "b1", "u/p", "200", h(2))
    push_pointer(con, "b1", "u/p", "latest", h(2))
    push_pointer(con, "b1", "u/p", "300", h(9))  # its manifest is not in the bucket
    push_pointer(con, "b1", "u/p", "dangling", h(9))


def test_fill_copies_a_bucket_pointers_whether_or_not_their_manifest_is_there(qm, con):
    push_bucket(con)
    push_manifest(con, "b2", h(3))
    push_pointer(con, "b2", "u/r", "latest", h(3))

    run(con, qm.fill("b1"))

    assert rows(con, "package_entry") == [entry("b1", h(1)), entry("b1", h(2))]
    assert rows(con, "package_manifest", "registry", "top_hash") == [("s3://b1", h(1)), ("s3://b1", h(2))]
    assert rows(con, "package_revision") == [
        ("s3://b1", "u/p", ts(100), h(1)),
        ("s3://b1", "u/p", ts(200), h(2)),
        ("s3://b1", "u/p", ts(300), h(9)),
    ]
    assert rows(con, "package_tag") == [
        ("s3://b1", "u/p", "dangling", h(9)),
        ("s3://b1", "u/p", "latest", h(2)),
    ]


def test_fill_skips_an_object_under_the_manifests_prefix_that_is_not_a_manifest(qm, con):
    push_manifest(con, "b1", h(1))
    push_manifest(con, "b1", f"sub/{h(1)}", keys=("other.txt",))
    push_manifest(con, "b1", f"{h(2)}.parquet")

    run(con, qm.fill("b1"))

    assert rows(con, "package_entry") == [entry("b1", h(1))]
    assert rows(con, "package_manifest", "registry", "top_hash", "message") == [("s3://b1", h(1), f"msg {h(1)}")]


def test_fill_writes_one_revision_for_a_timestamp_two_pointer_names_spell(qm, con):
    push_pointer(con, "b1", "u/p", "0100", h(1))
    push_pointer(con, "b1", "u/p", "100", h(2))

    run(con, qm.fill("b1"))

    assert rows(con, "package_revision", "pkg_name", "timestamp", "top_hash") == [("u/p", ts(100), h(2))]


def test_fill_skips_an_object_under_the_pointers_prefix_that_names_no_package(qm, con):
    push_manifest(con, "b1", h(1))
    for name in ("README", "100", "u/p", "u/100", "a/b/c/latest"):
        con.execute(
            f'INSERT INTO "{USER_DB}"."b1_packages" VALUES (?, ?)', [f"s3://b1/.quilt/named_packages/{name}", h(1)]
        )

    run(con, qm.fill("b1"))
    run(con, qm.fill("b1"))

    assert rows(con, "package_tag") == []
    assert rows(con, "package_revision") == []


def test_fill_writes_a_manifest_row_only_with_its_entries_in_the_set_or_none_to_write(qm, con):
    push_manifest(con, "b1", h(1))
    entries, manifests, *_ = qm.fill("b1")

    run(con, [entries])
    push_manifest(con, "b1", h(2))  # between the fill's two reads
    push_manifest(con, "b1", h(3), keys=())  # likewise, a package of no entries
    run(con, [manifests])

    assert rows(con, "package_entry", "top_hash") == [(h(1),)]
    assert rows(con, "package_manifest", "top_hash") == [(h(1),), (h(3),)]


def test_fill_writes_a_bucket_entries_before_its_manifests(qm, con):
    push_bucket(con)
    filled = []

    for sql in qm.fill("b1"):
        run(con, [sql])
        filled.append({t for t in TABLES if rows(con, t)})

    assert filled[:2] == [{"package_entry"}, {"package_entry", "package_manifest"}]


def test_fill_again_writes_only_moved_pointers(qm, con):
    push_bucket(con)
    run(con, qm.fill("b1"))
    assert run(con, qm.fill("b1")) == [0, 0, 0, 0]

    con.execute(f"""UPDATE "{USER_DB}"."b1_packages" SET top_hash = '{h(1)}' WHERE "$path" LIKE '%/latest'""")
    con.execute(f"""UPDATE "{USER_DB}"."b1_packages" SET top_hash = '{h(1)}' WHERE "$path" LIKE '%/200'""")

    assert run(con, qm.fill("b1")) == [0, 0, 1, 1]
    assert rows(con, "package_tag") == [("s3://b1", "u/p", "dangling", h(9)), ("s3://b1", "u/p", "latest", h(1))]
    assert rows(con, "package_revision") == [
        ("s3://b1", "u/p", ts(100), h(1)),
        ("s3://b1", "u/p", ts(200), h(1)),
        ("s3://b1", "u/p", ts(300), h(9)),
    ]


def test_remove_deletes_one_registry_rows_from_every_table(qm, con):
    for bucket in BUCKETS:
        insert(con, "package_entry", entry(bucket, h(1)))
        insert(con, "package_manifest", (f"s3://{bucket}", h(1), "", "{}"))
        insert(con, "package_revision", (f"s3://{bucket}", "u/p", ts(100), h(1)))
        insert(con, "package_tag", (f"s3://{bucket}", "u/p", "latest", h(1)))

    run(con, qm.remove("b1"))

    for table in TABLES:
        assert rows(con, table, "registry") == [("s3://b2",)]


def manifests(bucket: str, n: int) -> list[Manifest]:
    return [Manifest(bucket, h(i)) for i in range(n)]


BATCHES = {
    # builder: (items for a registry with `n` keys, the most hash buckets one registry's items reach)
    "entry_upsert": (manifests, 16),
    "manifest_upsert": (manifests, 16),
    "entry_delete": (manifests, 16),
    "manifest_delete": (manifests, 16),
    "revision_upsert": (lambda b, n: [Pointer(b, f"u/p{i}", "100", h(1)) for i in range(n)], 8),
    "revision_delete": (lambda b, n: [PointerKey(b, f"u/p{i}", "100") for i in range(n)], 8),
    "tag_upsert": (lambda b, n: [Pointer(b, f"u/p{i}", "latest", h(1)) for i in range(n)], 1),
    "tag_delete": (lambda b, n: [PointerKey(b, f"u/p{i}", "latest") for i in range(n)], 1),
}


@pytest.mark.parametrize("builder", BATCHES)
def test_a_statement_writes_at_most_100_partitions(qm, builder):
    make, buckets = BATCHES[builder]
    # Enough keys for each registry to reach every hash bucket, few enough to stay under the size limit.
    items = [i for r in range(150) for i in make(f"bucket{r}", buckets + 1)]

    statements = getattr(qm, builder)(items)

    for s in statements:
        assert len({i.bucket for i in s.items}) <= MAX_PARTITIONS // buckets
    assert sorted(i for s in statements for i in s.items) == sorted(items)


def test_registries_with_fewer_keys_than_hash_buckets_share_a_statement(qm):
    items = [Manifest(f"bucket{r}", h(i)) for r in range(50) for i in range(2)]

    assert len(qm.entry_upsert(items)) == 1


def test_a_statement_stays_under_the_query_size_limit_in_bytes(qm, con):
    pkg_name = "ü" * 300  # two bytes a character
    items = [Pointer("b1", f"{pkg_name}/{i}", "100", h(1)) for i in range(250)]

    statements = qm.revision_upsert(items)

    assert len(statements) > 1
    assert sum(len(s.sql) for s in statements) < MAX_QUERY_BYTES
    assert all(len(s.sql.encode()) <= MAX_QUERY_BYTES for s in statements)
    assert sorted(i for s in statements for i in s.items) == sorted(items)
    run(con, statements)
    assert len(rows(con, "package_revision")) == len(items)


def test_quotes_in_values_reach_the_set_verbatim(qm, con):
    # Doubled, so a value left unescaped still parses, and loses a quote.
    top_hash, pkg_name, tag = "o''h", "o''brien/p", "it''s"
    insert(con, "package_manifest", ("s3://b1", top_hash, "", "{}"))
    insert(con, "package_entry", entry("b1", top_hash))
    manifest = Manifest("b1", top_hash)

    run(
        con,
        qm.revision_upsert([Pointer("b1", pkg_name, "100", top_hash)])
        + qm.tag_upsert([Pointer("b1", pkg_name, tag, top_hash)]),
    )
    assert rows(con, "package_revision", "pkg_name", "top_hash") == [(pkg_name, top_hash)]
    assert rows(con, "package_tag", "pkg_name", "tag_name", "top_hash") == [(pkg_name, tag, top_hash)]

    run(
        con,
        qm.tag_delete([PointerKey("b1", pkg_name, tag)])
        + qm.revision_delete([PointerKey("b1", pkg_name, "100")])
        + qm.manifest_delete([manifest])
        + qm.entry_delete([manifest]),
    )
    assert [t for t in TABLES if rows(con, t)] == []


@pytest.mark.parametrize("builder", BATCHES)
def test_an_empty_batch_has_no_statements(qm, builder):
    assert getattr(qm, builder)([]) == []
