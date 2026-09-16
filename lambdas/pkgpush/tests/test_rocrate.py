import copy
import io
import json

import pytest

import t4_lambda_pkgpush
from quilt3.util import PhysicalKey, validate_package_name
from t4_lambda_pkgpush import rocrate

CRATE_PK = PhysicalKey("bucket", "experiments/260908_ale_ELNID/ro-crate-metadata.json", None)

SAMPLE = {
    "@context": "https://w3id.org/ro/crate/1.1/context",
    "@graph": [
        {
            "@id": "ro-crate-metadata.json",
            "@type": "CreativeWork",
            "about": {"@id": "./"},
            "conformsTo": {"@id": "https://w3id.org/ro/crate/1.1"},
        },
        {
            "@id": "./",
            "@type": "Dataset",
            "name": "260908_ale_ELNID",
            "dateCreated": None,
            "hasPart": [{"@id": "test_file.txt"}],
            "creator": {"@id": "#author"},
            "producer": {"@id": "#lab-subgroup"},
        },
        {"@id": "#author", "@type": "Person", "name": "ale"},
        {"@id": "#package-prefix", "@type": "Namespace", "name": "ale"},
        {"@id": "experiment-id", "@type": "Benchling", "name": "EXP_1234_Test"},
        {
            "@id": "WIN-K5VP59KK43U",
            "@type": "Instrument",
            "name": "Cytoflex LX 1",
            "identifier": "WIN-K5VP59KK43U",
        },
        {
            "@id": "#lab-subgroup",
            "@type": "Organization",
            "name": "ADQC",
            "parentOrganization": {"@id": "#lab-group"},
        },
        {"@id": "#lab-group", "@type": "Organization", "name": "TechOps"},
        {
            "@id": "test_file.txt",
            "@type": "File",
            "name": "test_file.txt",
            "dateCreated": "2026-09-08T09:14:22",
            "dateModified": "2026-09-08T09:14:22",
            "creator": {"@id": "#author"},
        },
    ],
}

EXPECTED_META = {
    "person.author": "ale",
    "benchling.experiment-id": "EXP_1234_Test",
    "instrument.WIN-K5VP59KK43U": "Cytoflex LX 1",
    "organization.lab-subgroup": "ADQC",
    "organization.lab-group": "TechOps",
}


def crate_without(*ids):
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"] = [e for e in doc["@graph"] if e["@id"] not in ids]
    return doc


def root_of(doc):
    return next(e for e in doc["@graph"] if e["@id"] == "./")


@pytest.mark.parametrize(
    "doc, expected",
    [
        (SAMPLE, True),
        ({"@graph": [{"@id": "./", "@type": ["Dataset", "Thing"]}]}, True),
        ({"@graph": [{"@id": "./", "@type": "Thing"}]}, False),
        ({"@graph": "nope"}, False),
        ({"experiment_id": "EXP_1"}, False),
        ([], False),
        (None, False),
    ],
)
def test_is_rocrate(doc, expected):
    assert rocrate.is_rocrate(doc) is expected


def test_parse_sample():
    crate = rocrate.parse(SAMPLE, CRATE_PK)

    assert crate.name_prefix == "ale"
    assert crate.name_suffix == "260908_ale_ELNID"
    assert crate.user_meta == EXPECTED_META
    assert [e.logical_key for e in crate.entries] == ["test_file.txt", "ro-crate-metadata.json"]

    data, crate_entry = crate.entries
    assert data.physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/test_file.txt", None)
    assert data.user_meta == {
        "dateCreated": "2026-09-08T09:14:22",
        "dateModified": "2026-09-08T09:14:22",
        "creator": {"@id": "#author"},
    }
    assert crate_entry.physical_key == CRATE_PK
    assert crate_entry.user_meta is None


def test_parse_no_namespace_no_dataset_name():
    doc = crate_without("#package-prefix")
    del root_of(doc)["name"]
    crate = rocrate.parse(doc, CRATE_PK)
    assert crate.name_prefix is None
    assert crate.name_suffix is None


def test_parse_entity_without_name_uses_identifier_or_skips():
    doc = copy.deepcopy(SAMPLE)
    for e in doc["@graph"]:
        if e["@id"] == "WIN-K5VP59KK43U":
            del e["name"]
        if e["@id"] == "#lab-group":
            del e["name"]
    meta = rocrate.parse(doc, CRATE_PK).user_meta
    assert meta["instrument.WIN-K5VP59KK43U"] == "WIN-K5VP59KK43U"
    assert "organization.lab-group" not in meta


def test_parse_multi_type_uses_first():
    doc = copy.deepcopy(SAMPLE)
    for e in doc["@graph"]:
        if e["@id"] == "#lab-group":
            e["@type"] = ["Organization", "Thing"]
    assert rocrate.parse(doc, CRATE_PK).user_meta["organization.lab-group"] == "TechOps"


def test_parse_duplicate_key_fails():
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"].append({"@id": "lab-group", "@type": "Organization", "name": "Other"})
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        rocrate.parse(doc, CRATE_PK)
    assert excinfo.value.name == "RoCrateDuplicateKey"
    assert excinfo.value.context == {"key": "organization.lab-group"}


def test_parse_file_with_only_structural_props_has_no_meta():
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"] = [
        {"@id": "test_file.txt", "@type": "File", "name": "test_file.txt"} if e["@id"] == "test_file.txt" else e
        for e in doc["@graph"]
    ]
    assert rocrate.parse(doc, CRATE_PK).entries[0].user_meta is None


def test_parse_haspart_absolute_and_dotslash():
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [
        {"@id": "./sub/a.csv"},
        {"@id": "s3://other-bucket/raw/b.fcs?versionId=v1"},
    ]
    entries = {e.logical_key: e for e in rocrate.parse(doc, CRATE_PK).entries}
    assert entries["sub/a.csv"].physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/sub/a.csv", None)
    assert entries["b.fcs"].physical_key == PhysicalKey("other-bucket", "raw/b.fcs", "v1")


def test_parse_haspart_unlisted_file_gets_no_meta():
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "orphan.txt"}]
    entries = rocrate.parse(doc, CRATE_PK).entries
    assert entries[0].logical_key == "orphan.txt"
    assert entries[0].user_meta is None


@pytest.mark.parametrize(
    "part_id, error",
    [
        ("../escape.txt", "RoCrateInvalidPart"),
        ("sub/../escape.txt", "RoCrateInvalidPart"),
        ("sub/./data.csv", "RoCrateInvalidPart"),
        ("sub//data.csv", "RoCrateInvalidPart"),
        ("/abs.txt", "RoCrateInvalidPart"),
        ("https://example.com/x.txt", "RoCrateInvalidPart"),
        ("./", "RoCrateInvalidPart"),
        ("s3://other-bucket", "RoCrateInvalidPart"),
        (42, "RoCrateInvalidPart"),
    ],
)
def test_parse_haspart_rejects(part_id, error):
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": part_id}]
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        rocrate.parse(doc, CRATE_PK)
    assert excinfo.value.name == error


@pytest.mark.parametrize(
    "part_id, dataset_entity, logical_key, physical_key",
    [
        ("sub/", False, "sub/", PhysicalKey("bucket", "experiments/260908_ale_ELNID/sub/", None)),
        ("sub", True, "sub/", PhysicalKey("bucket", "experiments/260908_ale_ELNID/sub/", None)),
        ("./sub/", True, "sub/", PhysicalKey("bucket", "experiments/260908_ale_ELNID/sub/", None)),
        ("s3://other-bucket/raw/run1/", False, "run1/", PhysicalKey("other-bucket", "raw/run1/", None)),
        ("s3://other-bucket/raw/run1", True, "run1/", PhysicalKey("other-bucket", "raw/run1/", None)),
    ],
)
def test_parse_haspart_directory(part_id, dataset_entity, logical_key, physical_key):
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": part_id}]
    if dataset_entity:
        doc["@graph"].append({"@id": part_id, "@type": "Dataset", "name": "sub", "dateCreated": "2026-01-01"})
    entry = rocrate.parse(doc, CRATE_PK).entries[0]
    assert entry.is_dir is True
    assert entry.logical_key == logical_key
    assert entry.physical_key == physical_key
    assert entry.user_meta is None


def test_parse_crate_listed_in_haspart_not_duplicated():
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": "ro-crate-metadata.json"})
    crate = rocrate.parse(doc, CRATE_PK)
    assert [e.logical_key for e in crate.entries] == ["test_file.txt", "ro-crate-metadata.json"]


def test_parse_keeps_crate_version():
    versioned = PhysicalKey(CRATE_PK.bucket, CRATE_PK.path, "v1")
    crate = rocrate.parse(copy.deepcopy(SAMPLE), versioned)
    assert crate.entries[-1].physical_key == versioned


def test_parse_foreign_crate_name_does_not_displace_provenance():
    """Another crate under the provenance logical key is a conflict, not a silent swap."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": "s3://other-bucket/other/ro-crate-metadata.json"})
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        rocrate.parse(doc, CRATE_PK)
    assert excinfo.value.name == "RoCrateDuplicateEntry"
    assert excinfo.value.context == {"logical_key": "ro-crate-metadata.json"}


@pytest.mark.parametrize(
    "part_id, logical_key, path",
    [
        ("sample%201.csv", "sample 1.csv", "experiments/260908_ale_ELNID/sample 1.csv"),
        ("sub/a%23b.csv", "sub/a#b.csv", "experiments/260908_ale_ELNID/sub/a#b.csv"),
    ],
)
def test_parse_haspart_relative_uri_is_unquoted(part_id, logical_key, path):
    """A relative @id is a URI reference, like the absolute ones PhysicalKey unquotes."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": part_id}]
    entry = rocrate.parse(doc, CRATE_PK).entries[0]
    assert entry.logical_key == logical_key
    assert entry.physical_key == PhysicalKey("bucket", path, None)


@pytest.mark.parametrize(
    "prefix_name, suffix_name, expected",
    [
        ("ale", "RNA sequencing run 1", "ale/RNA-sequencing-run-1"),
        ("lab group", "260908", "lab-group/260908"),
        ("...", "260908", "experiments/260908"),
    ],
)
def test_package_prefix_crate_name_is_sanitized(mocker, packager_stubs, prefix_name, suffix_name, expected):
    """A crate name is written for people; the package name grammar admits [\\w-] only."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["name"] = suffix_name
    for e in doc["@graph"]:
        if e["@id"] == "#package-prefix":
            e["name"] = prefix_name
    get_object_stub(mocker, doc)

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
            }
        ),
        None,
    )

    _, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == expected
    validate_package_name(kwargs["name"])


# --- package_prefix() integration -------------------------------------------------


@pytest.fixture
def packager_stubs(mocker):
    """Stop package_prefix() at the boundary where it would touch S3 or the registry."""
    mocker.patch.object(
        t4_lambda_pkgpush, "get_checksum_algorithms", return_value=[t4_lambda_pkgpush.ChecksumAlgorithm.SHA256_CHUNKED]
    )
    mocker.patch.object(t4_lambda_pkgpush, "get_package_registry")
    mocker.patch.object(t4_lambda_pkgpush, "complete_entries_metadata")
    mocker.patch.object(t4_lambda_pkgpush, "calculate_pkg_hashes")
    mocker.patch.object(t4_lambda_pkgpush, "get_scratch_buckets", return_value={})
    mocker.patch("quilt3.Package._validate_with_workflow")
    build = mocker.patch("quilt3.Package._build", autospec=True, return_value="top-hash")
    return build


def get_object_stub(mocker, doc):
    return mocker.patch.object(
        t4_lambda_pkgpush.s3,
        "get_object",
        return_value={"Body": io.BytesIO(json.dumps(doc).encode())},
    )


def built_package(build_mock):
    (pkg,), kwargs = build_mock.call_args
    return pkg, kwargs


def test_package_prefix_crate_mode(mocker, packager_stubs):
    get_object_stub(mocker, SAMPLE)
    list_prefix = mocker.patch.object(t4_lambda_pkgpush, "list_prefix_latest_versions")

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
            }
        ),
        None,
    )

    list_prefix.assert_not_called()
    pkg, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "ale/260908_ale_ELNID"
    assert pkg.meta == EXPECTED_META
    assert sorted(lk for lk, _ in pkg.walk()) == ["ro-crate-metadata.json", "test_file.txt"]
    entry = pkg["test_file.txt"]
    assert entry.physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/test_file.txt", None)
    assert entry.meta == {
        "dateCreated": "2026-09-08T09:14:22",
        "dateModified": "2026-09-08T09:14:22",
        "creator": {"@id": "#author"},
    }
    assert pkg["ro-crate-metadata.json"].meta == {}


def test_package_prefix_crate_mode_expands_directory_parts(mocker, packager_stubs):
    """A directory part is swept; a file the crate also lists explicitly keeps its metadata."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "out/"}, {"@id": "out/b.csv"}]
    doc["@graph"].append({"@id": "out/b.csv", "@type": "File", "name": "b.csv", "dateCreated": "2026-01-01"})
    get_object_stub(mocker, doc)
    list_prefix = mocker.patch.object(
        t4_lambda_pkgpush,
        "list_prefix_latest_versions",
        return_value=[
            {"Key": "experiments/260908_ale_ELNID/out/a.csv", "Size": 1, "VersionId": "va"},
            {"Key": "experiments/260908_ale_ELNID/out/b.csv", "Size": 2, "VersionId": "vb"},
        ],
    )

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
            }
        ),
        None,
    )

    list_prefix.assert_called_once_with("bucket", "experiments/260908_ale_ELNID/out/")
    pkg, _ = built_package(packager_stubs)
    assert sorted(lk for lk, _ in pkg.walk()) == ["out/a.csv", "out/b.csv", "ro-crate-metadata.json"]
    assert pkg["out/a.csv"].physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/out/a.csv", "va")
    assert pkg["out/a.csv"].meta == {}
    # Listed explicitly: unversioned until complete_entries_metadata(), and carries its crate metadata.
    assert pkg["out/b.csv"].physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/out/b.csv", None)
    assert pkg["out/b.csv"].meta == {"dateCreated": "2026-01-01"}


def test_package_prefix_crate_mode_name_fallbacks(mocker, packager_stubs):
    doc = crate_without("#package-prefix")
    del root_of(doc)["name"]
    get_object_stub(mocker, doc)

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
            }
        ),
        None,
    )

    _, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "experiments/260908_ale_ELNID"


def test_package_prefix_explicit_name_wins(mocker, packager_stubs):
    get_object_stub(mocker, SAMPLE)

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                "package_name": "explicit/name",
            }
        ),
        None,
    )

    _, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "explicit/name"


def test_package_prefix_crate_error_is_pkgpush_exception(mocker, packager_stubs):
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "../escape.txt"}]
    get_object_stub(mocker, doc)

    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
        t4_lambda_pkgpush.package_prefix(
            json.dumps(
                {
                    "source_prefix": "s3://bucket/experiments/x/ro-crate-metadata.json",
                    "metadata_uri": "s3://bucket/experiments/x/ro-crate-metadata.json",
                }
            ),
            None,
        )
    assert excinfo.value.name == "RoCrateInvalidPart"


def test_package_prefix_legacy_mode_unchanged(mocker, packager_stubs):
    """A metadata document that is not a crate still means: sweep the folder, meta verbatim."""
    legacy_meta = {"experiment_id": "EXP_1"}
    get_object_stub(mocker, legacy_meta)
    mocker.patch.object(
        t4_lambda_pkgpush,
        "list_prefix_latest_versions",
        return_value=[
            {"Key": "experiments/x/a.txt", "Size": 1, "VersionId": "v1"},
            {"Key": "experiments/x/meta.json", "Size": 2, "VersionId": "v2"},
        ],
    )

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/experiments/x/",
                "metadata_uri": "s3://bucket/experiments/x/meta.json",
            }
        ),
        None,
    )

    pkg, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "experiments/x"
    assert pkg.meta == legacy_meta
    assert sorted(lk for lk, _ in pkg.walk()) == ["a.txt", "meta.json"]
    assert pkg["a.txt"].physical_key == PhysicalKey("bucket", "experiments/x/a.txt", "v1")
    assert pkg["a.txt"].meta == {}
