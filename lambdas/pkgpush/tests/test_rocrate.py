import copy
import io
import json
import pathlib

import botocore.exceptions
import pytest

import t4_lambda_pkgpush
from quilt3.util import PhysicalKey, validate_package_name
from t4_lambda_pkgpush import rocrate

CRATE_PK = PhysicalKey("bucket", "experiments/260908_ale_ELNID/ro-crate-metadata.json", None)

# The canonical nf-prov WRROC (quilt-example-bucket example/wrroc/ro-crate-metadata.json,
# version ez_H9dTk41yptiJoVaLRL1SIduvvmu33): repeats two provenance nodes verbatim and
# lists its license URL as a part, both of which parse() has to survive.
WRROC_PATH = pathlib.Path(__file__).parent / "data" / "wrroc-canonical.json"

# A pre-profile emitter, the shape labs are writing today: it states creator,
# producer and per-file provenance, but reaches its instrument only from each
# File's isBasedOn, and names the package with a bare root name. Synthetic, and
# reduced from crates in the field.
PRE_PROFILE_PATH = pathlib.Path(__file__).parent / "data" / "pre-profile-emitter.json"

# The Quilt RO-Crate profile's conforming example, copied verbatim from
# quiltdata/quilt-ro-crate-profile 0.1/example1/ro-crate-metadata.json at 3af25f4.
PROFILE_EXAMPLE = json.loads((pathlib.Path(__file__).parent / "data" / "quilt-profile-example1.json").read_text())
PROFILE_EXAMPLE_PK = PhysicalKey("bucket", "runs/2026-09-08-assay-01/ro-crate-metadata.json", "v1")
ACTION_ID = "urn:uuid:9f1c4e2a-5b73-4a1e-8c0d-2e7f6a3b9d41"
INSTRUMENT_ID = "https://example.org/instruments/INST-000123"
ELN_ID = "https://eln.example.org/entries/etr_AbC123"
# The projection the profile's consumer requirements give for that example, minus
# package_name, which package_prefix() adds once the published name is settled.
PROFILE_PROJECTION = {
    "creator": ["Jane Doe"],
    "producer": ["Assay Development", "Laboratory Operations"],
    "instrument": ["Flow Cytometer 1"],
    "instrument_id": ["INST-000123"],
    "eln_entry": ["ASSAY-1234"],
}

# The pre-profile Vir crate shape, declaring no profile, with its namespace moved to
# a packageNamespace PropertyValue. Its ad-hoc types stay to show that nothing
# unreachable by role becomes package metadata.
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
            "identifier": {"@id": "#quilt-namespace"},
            "creator": {"@id": "#author"},
            "producer": {"@id": "#lab-subgroup"},
        },
        {"@id": "#author", "@type": "Person", "name": "ale"},
        {
            "@id": "#quilt-namespace",
            "@type": "PropertyValue",
            "propertyID": "https://w3id.org/quilt/ro-crate#packageNamespace",
            "value": "ale",
        },
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

EXPECTED_META = {"creator": ["ale"], "producer": ["ADQC", "TechOps"]}
DEFAULT_NAME = "experiments/260908_ale_ELNID"


def crate_without(*ids):
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"] = [e for e in doc["@graph"] if e["@id"] not in ids]
    return doc


def root_of(doc):
    return next(e for e in doc["@graph"] if e["@id"] == "./")


def entity(doc, entity_id):
    return next(e for e in doc["@graph"] if e["@id"] == entity_id)


def parse(doc, crate_pk=CRATE_PK):
    return rocrate.parse(doc, crate_pk, DEFAULT_NAME)


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
    crate = parse(SAMPLE)

    assert crate.package_name == "ale/260908_ale_ELNID"
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


# --- The Quilt RO-Crate profile ----------------------------------------------------


def test_parse_profile_example():
    """The profile's own example crate yields the profile's own example projection."""
    crate = rocrate.parse(copy.deepcopy(PROFILE_EXAMPLE), PROFILE_EXAMPLE_PK, "runs/2026-09-08-assay-01")

    assert crate.package_name == "assay-dev/2026-09-08-assay-01"
    assert crate.user_meta == PROFILE_PROJECTION
    data, crate_entry = crate.entries
    assert data.logical_key == "01-Well-A1.fcs"
    assert data.physical_key == PhysicalKey("bucket", "runs/2026-09-08-assay-01/01-Well-A1.fcs", None)
    # Instrument timestamps and the checksum survive onto the entry.
    assert data.user_meta == {
        "encodingFormat": "application/vnd.isac.fcs",
        "contentSize": "2405376",
        "sha256": "f3278e796c687371cc63a600b6f12ea32167067fed3ef98099d0c1aad2426531",
        "dateCreated": "2026-09-08T20:57:29Z",
        "dateModified": "2026-09-08T20:57:29Z",
        "variableMeasured": {"@id": "#well-a1"},
    }
    assert crate_entry.physical_key == PROFILE_EXAMPLE_PK


def profile_crate(mutate):
    doc = copy.deepcopy(PROFILE_EXAMPLE)
    mutate(doc)
    return doc


def _set(entity_id, key, value):
    return lambda doc: entity(doc, entity_id).__setitem__(key, value)


def _del(entity_id, key):
    return lambda doc: entity(doc, entity_id).pop(key)


def _append(new_entity):
    return lambda doc: doc["@graph"].append(new_entity)


def _add_software_step(doc):
    """A compensation step beside the acquisition, as Process Run Crate describes one."""
    root_of(doc)["mentions"] = [root_of(doc)["mentions"], {"@id": "#compensation"}]
    doc["@graph"] += [
        {
            "@id": "#compensation",
            "@type": "CreateAction",
            "instrument": {"@id": "#flowjo"},
            "object": {"@id": "01-Well-A1.fcs"},
        },
        {"@id": "#flowjo", "@type": "SoftwareApplication", "name": "FlowJo"},
    ]


# Ways a crate declaring the profile can depart from its recommendations. None stops
# Quilt from building the package the crate describes, so none is grounds to reject.
PRODUCER_CHOICES = {
    "ro-crate-1.1": _set("ro-crate-metadata.json", "conformsTo", {"@id": "https://w3id.org/ro/crate/1.1"}),
    "context-mismatch": lambda doc: doc.__setitem__("@context", "https://w3id.org/ro/crate/1.1/context"),
    "null": _set("./", "dateCreated", None),
    "inline-entity": _set("01-Well-A1.fcs", "variableMeasured", {"@type": "PropertyValue", "value": "A1"}),
    "no-description": _del("./", "description"),
    "no-license": _del("./", "license"),
    "part-without-entity": lambda doc: root_of(doc)["hasPart"].append({"@id": "orphan.fcs"}),
    "person-fragment-id": _append({"@id": "#jdoe", "@type": "Person", "name": "Jane Doe"}),
    "instrument-no-identifier": _del(INSTRUMENT_ID, "identifier"),
    "action-not-mentioned": _del("./", "mentions"),
    "action-no-end-time": _del(ACTION_ID, "endTime"),
    "eln-no-provider": _del(ELN_ID, "provider"),
    "software-step": _add_software_step,
}


@pytest.mark.parametrize("mutate", PRODUCER_CHOICES.values(), ids=PRODUCER_CHOICES.keys())
def test_parse_profile_recommendations_are_not_enforced(mutate):
    """Quilt rejects only what it cannot package as written; the rest is the producer's call."""
    crate = parse(profile_crate(mutate))
    assert crate.package_name == "assay-dev/2026-09-08-assay-01"
    assert "01-Well-A1.fcs" in [e.logical_key for e in crate.entries]


def test_parse_software_step_instrument_is_projected():
    """Role, not type: a software instrument under mentions is an instrument too."""
    meta = parse(profile_crate(PRODUCER_CHOICES["software-step"])).user_meta
    assert meta["instrument"] == ["Flow Cytometer 1", "FlowJo"]
    assert meta["instrument_id"] == ["INST-000123"]


def test_parse_inline_entities_are_read():
    """An entity written inline instead of referenced still names the package and fills roles."""
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"] = [e for e in doc["@graph"] if e["@id"] not in ("#quilt-namespace", "#lab-subgroup")]
    root_of(doc)["identifier"] = {
        "@type": "PropertyValue",
        "propertyID": rocrate.PACKAGE_NAMESPACE_TERM,
        "value": "inline",
    }
    root_of(doc)["producer"] = {
        "@type": "Organization",
        "name": "ADQC",
        "parentOrganization": {"@id": "#lab-group"},
    }
    crate = parse(doc)
    assert crate.package_name == "inline/260908_ale_ELNID"
    assert crate.user_meta == EXPECTED_META


# --- Package naming ------------------------------------------------------------------


def with_identifiers(doc, *properties):
    """Replace the root's identifier with PropertyValues of (propertyID, value)."""
    doc = copy.deepcopy(doc)
    doc["@graph"] = [e for e in doc["@graph"] if e.get("@type") != "PropertyValue" or e["@id"] == "#well-a1"]
    root_of(doc)["identifier"] = [{"@id": f"#id-{i}"} for i in range(len(properties))]
    for i, (property_id, value) in enumerate(properties):
        doc["@graph"].append({"@id": f"#id-{i}", "@type": "PropertyValue", "propertyID": property_id, "value": value})
    return doc


def test_parse_package_name_wins_over_namespace():
    doc = with_identifiers(
        SAMPLE, (rocrate.PACKAGE_NAMESPACE_TERM, "other"), (rocrate.PACKAGE_NAME_TERM, "explicit/name")
    )
    assert parse(doc).package_name == "explicit/name"


def test_parse_package_name_term_as_reference():
    """propertyID written as {"@id": term} is the same term as the plain string."""
    doc = with_identifiers(SAMPLE, ({"@id": rocrate.PACKAGE_NAME_TERM}, "explicit/name"))
    assert parse(doc).package_name == "explicit/name"


def test_parse_package_name_repeated_identically_is_one_name():
    doc = with_identifiers(SAMPLE, (rocrate.PACKAGE_NAME_TERM, "a/b"), (rocrate.PACKAGE_NAME_TERM, "a/b"))
    assert parse(doc).package_name == "a/b"


@pytest.mark.parametrize(
    "root_name, expected",
    [
        ("RNA sequencing run 1", "ale/RNA-sequencing-run-1"),
        # A title that sanitizes to nothing leaves the name half to the default.
        ("...", "ale/260908_ale_ELNID"),
        (None, "ale/260908_ale_ELNID"),
    ],
)
def test_parse_namespace_joins_sanitized_root_name(root_name, expected):
    """The root's name is a title written for people, so the half derived from it is sanitized."""
    doc = copy.deepcopy(SAMPLE)
    if root_name is None:
        del root_of(doc)["name"]
    else:
        root_of(doc)["name"] = root_name
    name = parse(doc).package_name
    assert name == expected
    validate_package_name(name)


@pytest.mark.parametrize(
    "properties, context",
    [
        (
            [(rocrate.PACKAGE_NAME_TERM, "Assay run 1")],
            {"term": rocrate.PACKAGE_NAME_TERM, "value": "Assay run 1"},
        ),
        ([(rocrate.PACKAGE_NAME_TERM, "no-slash")], {"term": rocrate.PACKAGE_NAME_TERM, "value": "no-slash"}),
        ([(rocrate.PACKAGE_NAME_TERM, "a/b/c")], {"term": rocrate.PACKAGE_NAME_TERM, "value": "a/b/c"}),
        ([(rocrate.PACKAGE_NAME_TERM, "a/b\n")], {"term": rocrate.PACKAGE_NAME_TERM, "value": "a/b\n"}),
        ([(rocrate.PACKAGE_NAME_TERM, 42)], {"term": rocrate.PACKAGE_NAME_TERM, "value": 42}),
        (
            [(rocrate.PACKAGE_NAME_TERM, "a/b"), (rocrate.PACKAGE_NAME_TERM, "c/d")],
            {"term": rocrate.PACKAGE_NAME_TERM, "values": ["a/b", "c/d"]},
        ),
        (
            [(rocrate.PACKAGE_NAMESPACE_TERM, "lab group")],
            {"term": rocrate.PACKAGE_NAMESPACE_TERM, "value": "lab group"},
        ),
        ([(rocrate.PACKAGE_NAMESPACE_TERM, "a/b")], {"term": rocrate.PACKAGE_NAMESPACE_TERM, "value": "a/b"}),
        # A bad namespace is a producer bug even when an explicit name makes it moot.
        (
            [(rocrate.PACKAGE_NAME_TERM, "a/b"), (rocrate.PACKAGE_NAMESPACE_TERM, "lab group")],
            {"term": rocrate.PACKAGE_NAMESPACE_TERM, "value": "lab group"},
        ),
    ],
)
def test_parse_invalid_package_name_rejected(properties, context):
    """An explicit name is rejected rather than corrected, so the producer finds out."""
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        parse(with_identifiers(SAMPLE, *properties))
    assert excinfo.value.name == "RoCrateInvalidPackageName"
    assert excinfo.value.context == context


def test_parse_no_naming_uses_default():
    """A root name alone does not name the package; only a profile identifier does."""
    assert parse(crate_without("#quilt-namespace")).package_name == DEFAULT_NAME


def test_parse_pre_profile_namespace_entity_is_ignored():
    """@type "Namespace" is not a schema.org type and is dropped on JSON-LD expansion."""
    doc = crate_without("#quilt-namespace")
    doc["@graph"].append({"@id": "#package-prefix", "@type": "Namespace", "name": "ale"})
    crate = parse(doc)
    assert crate.package_name == DEFAULT_NAME
    assert crate.user_meta == EXPECTED_META


# --- Package metadata projection ------------------------------------------------------


def test_parse_projection_follows_roles_not_types():
    """
    Entities reached by no role stay out, whatever their type: the Instrument and
    Benchling entities here are in the graph but not under the root's mentions or subjectOf.
    """
    meta = parse(SAMPLE).user_meta
    assert meta == EXPECTED_META
    assert "Cytoflex LX 1" not in json.dumps(meta)


def test_parse_projection_skips_unnamed_and_dangling():
    doc = copy.deepcopy(SAMPLE)
    del entity(doc, "#lab-group")["name"]
    root_of(doc)["creator"] = [{"@id": "#author"}, {"@id": "#nobody"}, "a literal"]
    assert parse(doc).user_meta == {"creator": ["ale"], "producer": ["ADQC"]}


def test_parse_projection_parent_organization_cycle_terminates():
    doc = copy.deepcopy(SAMPLE)
    entity(doc, "#lab-group")["parentOrganization"] = {"@id": "#lab-subgroup"}
    assert parse(doc).user_meta["producer"] == ["ADQC", "TechOps"]


def test_parse_projection_dedupes_and_reads_property_value_identifiers():
    doc = copy.deepcopy(PROFILE_EXAMPLE)
    second = {**entity(doc, ACTION_ID), "@id": "urn:uuid:second"}
    doc["@graph"].append(second)
    root_of(doc)["mentions"] = [{"@id": ACTION_ID}, {"@id": "urn:uuid:second"}]
    entity(doc, INSTRUMENT_ID)["identifier"] = [{"@id": "#serial"}, "INST-000123"]
    doc["@graph"].append({"@id": "#serial", "@type": "PropertyValue", "propertyID": "serial", "value": "SN-9"})
    meta = parse(doc).user_meta
    assert meta["instrument"] == ["Flow Cytometer 1"]
    assert meta["instrument_id"] == ["INST-000123", "SN-9"]


def test_parse_projection_eln_entry_needs_additional_type():
    """subjectOf can reference any CreativeWork; only an ELNEntry plays that role."""
    doc = copy.deepcopy(PROFILE_EXAMPLE)
    del entity(doc, ELN_ID)["additionalType"]
    assert "eln_entry" not in rocrate.parse(doc, PROFILE_EXAMPLE_PK, DEFAULT_NAME).user_meta


@pytest.mark.parametrize("duplicate_id", ["#lab-group", "test_file.txt"])
def test_parse_duplicate_id_identical_entity_kept(duplicate_id):
    """nf-prov WRROC emitters repeat a node verbatim; a copy is not a conflict."""
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"].append(copy.deepcopy(next(e for e in doc["@graph"] if e["@id"] == duplicate_id)))
    crate = parse(doc)
    assert crate.user_meta == EXPECTED_META
    assert [e.logical_key for e in crate.entries] == ["test_file.txt", "ro-crate-metadata.json"]


def test_parse_duplicate_id_identical_entity_kept_across_id_spellings():
    """ "./x" and "x" are one URI reference; identical content there is still a copy."""
    doc = copy.deepcopy(SAMPLE)
    original = next(e for e in doc["@graph"] if e["@id"] == "test_file.txt")
    doc["@graph"].append({**copy.deepcopy(original), "@id": "./test_file.txt"})
    crate = parse(doc)
    assert crate.user_meta == EXPECTED_META
    assert [e.logical_key for e in crate.entries] == ["test_file.txt", "ro-crate-metadata.json"]


@pytest.mark.parametrize(
    "conflicting",
    [
        {"@id": "#lab-group", "@type": "Organization", "name": "Other"},
        {"@id": "#lab-group", "@type": "Person", "name": "TechOps"},
        {"@id": "#lab-group", "@type": "Organization", "name": "TechOps", "url": "https://example.com"},
    ],
    ids=["other-name", "other-type", "extra-property"],
)
def test_parse_duplicate_id_conflicting_entity_fails(conflicting):
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"].append(conflicting)
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        parse(doc)
    assert excinfo.value.name == "RoCrateDuplicateId"
    assert excinfo.value.context == {"id": "#lab-group"}


def test_parse_file_with_only_structural_props_has_no_meta():
    doc = copy.deepcopy(SAMPLE)
    doc["@graph"] = [
        {"@id": "test_file.txt", "@type": "File", "name": "test_file.txt"} if e["@id"] == "test_file.txt" else e
        for e in doc["@graph"]
    ]
    assert parse(doc).entries[0].user_meta is None


def test_parse_haspart_absolute_and_dotslash():
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [
        {"@id": "./sub/a.csv"},
        {"@id": "s3://other-bucket/raw/b.fcs?versionId=v1"},
    ]
    entries = {e.logical_key: e for e in parse(doc).entries}
    assert entries["sub/a.csv"].physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/sub/a.csv", None)
    assert entries["b.fcs"].physical_key == PhysicalKey("other-bucket", "raw/b.fcs", "v1")


def test_parse_haspart_unlisted_file_gets_no_meta():
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "orphan.txt"}]
    entries = parse(doc).entries
    assert entries[0].logical_key == "orphan.txt"
    assert entries[0].user_meta is None


@pytest.mark.parametrize(
    "part_id, entity_id",
    [
        ("sample%201.csv", "sample 1.csv"),
        ("sample 1.csv", "sample%201.csv"),
    ],
)
def test_parse_haspart_percent_encoding_still_finds_entity(part_id, entity_id):
    """An id is a URI reference, so the two spellings are one entity and keep its meta."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": part_id}]
    doc["@graph"].append({"@id": entity_id, "@type": "File", "name": "s", "dateCreated": "2026-01-01"})
    entries = {e.logical_key: e for e in parse(doc).entries}
    assert entries["sample 1.csv"].user_meta == {"dateCreated": "2026-01-01"}


def test_parse_part_entities_are_not_package_metadata():
    """A listed part is data whatever its type; its name must not become a package key."""
    doc = crate_without("test_file.txt")
    root_of(doc)["hasPart"] = [{"@id": "sub/"}, {"@id": "data.csv"}]
    doc["@graph"] += [
        {"@id": "sub/", "@type": "Dataset", "name": "Sub directory"},
        {"@id": "data.csv", "@type": "MediaObject", "name": "Data"},
    ]
    assert parse(doc).user_meta == EXPECTED_META


@pytest.mark.parametrize(
    "part_id, error",
    [
        ("../escape.txt", "RoCrateInvalidPart"),
        ("sub/../escape.txt", "RoCrateInvalidPart"),
        ("sub/./data.csv", "RoCrateInvalidPart"),
        ("sub//data.csv", "RoCrateInvalidPart"),
        # A directory's trailing "/" is syntax; an empty segment inside it is not.
        ("sub//", "RoCrateInvalidPart"),
        ("a/b//", "RoCrateInvalidPart"),
        ("sub/./", "RoCrateInvalidPart"),
        ("/abs.txt", "RoCrateInvalidPart"),
        ("ftp://example.com/x.txt", "RoCrateInvalidPart"),
        ("./", "RoCrateInvalidPart"),
        ("s3://other-bucket", "RoCrateInvalidPart"),
        # A malformed authority makes urlparse raise a bare ValueError.
        ("s3://[bad/key", "RoCrateInvalidPart"),
        # A fragment is not part of the key; packaging "key" would be another object.
        ("s3://other-bucket/key#fragment", "RoCrateInvalidPart"),
        (42, "RoCrateInvalidPart"),
    ],
)
def test_parse_haspart_rejects(part_id, error):
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": part_id}]
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        parse(doc)
    assert excinfo.value.name == error


@pytest.mark.parametrize(
    "part_id, entity_id",
    [
        ("s3://other/a%20b.csv", "s3://other/a b.csv"),
        ("s3://other/a b.csv", "s3://other/a%20b.csv"),
    ],
    ids=["part-encoded", "entity-encoded"],
)
def test_parse_haspart_s3_percent_encoding_still_finds_entity(part_id, entity_id):
    """An s3:// id is a URI reference: entity lookup decodes it as `_resolve_part` does.

    Keying `by_id` by the raw spelling instead dropped the File's metadata whenever
    the two disagreed, which is the metadata the crate exists to carry.
    """
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": part_id}]
    doc["@graph"].append({"@id": entity_id, "@type": "File", "dateCreated": "2026-01-01"})

    entries = {e.logical_key: e for e in parse(doc).entries}
    assert entries["a b.csv"].physical_key == PhysicalKey("other", "a b.csv", None)
    assert entries["a b.csv"].user_meta == {"dateCreated": "2026-01-01"}


@pytest.mark.parametrize(
    "part_id",
    ["urn:uuid:1f2c-aa", "doi:10.1234/abc", "mailto:data@example.org", "HTTPS://spdx.org/licenses/MIT"],
    ids=["urn", "doi", "mailto", "uppercase-scheme"],
)
def test_parse_haspart_reference_uri_is_skipped(part_id):
    """An identifier, or a web URI in any case, is a reference with no object to package.

    Matching only lowercase "http://" resolved an opaque scheme as a relative path,
    so "urn:uuid:..." became an S3 key that failed a HEAD much later.
    """
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": part_id})
    doc["@graph"].append({"@id": part_id, "@type": "CreativeWork"})

    assert [e.logical_key for e in parse(doc).entries] == ["test_file.txt", "ro-crate-metadata.json"]


@pytest.mark.parametrize("part_id", ["ftp://example.com/x.txt", "gs://bucket/key.csv"])
def test_parse_haspart_unfetchable_location_still_rejected(part_id):
    """A scheme that locates data this consumer cannot read fails, rather than vanishing."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": part_id})
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        parse(doc)
    assert excinfo.value.name == "RoCrateInvalidPart"


@pytest.mark.parametrize("web_id", ["https://spdx.org/licenses/MIT", "http://example.com/x.txt"])
def test_parse_haspart_web_uri_is_skipped(web_id):
    """A web-based data entity is legal RO-Crate but has no object to package."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": web_id})
    doc["@graph"].append({"@id": web_id, "@type": "CreativeWork"})
    crate = parse(doc)
    assert crate.user_meta == EXPECTED_META
    assert [e.logical_key for e in crate.entries] == ["test_file.txt", "ro-crate-metadata.json"]


@pytest.mark.parametrize("parts", [[], [{"@id": "https://spdx.org/licenses/MIT"}]], ids=["empty", "all-web"])
def test_parse_haspart_without_packageable_parts_fails(parts):
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = parts
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        parse(doc)
    assert excinfo.value.name == "RoCrateNoParts"
    assert excinfo.value.context == {"id": "./"}


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
    entry = parse(doc).entries[0]
    assert entry.is_dir is True
    assert entry.logical_key == logical_key
    assert entry.physical_key == physical_key
    assert entry.user_meta is None


def test_parse_crate_listed_in_haspart_not_duplicated():
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": "ro-crate-metadata.json"})
    crate = parse(doc)
    assert [e.logical_key for e in crate.entries] == ["test_file.txt", "ro-crate-metadata.json"]


def test_parse_keeps_crate_version():
    versioned = PhysicalKey(CRATE_PK.bucket, CRATE_PK.path, "v1")
    crate = parse(copy.deepcopy(SAMPLE), versioned)
    assert crate.entries[-1].physical_key == versioned


@pytest.mark.parametrize(
    "part_id, crate_pk",
    [
        ("s3://other-bucket/other/ro-crate-metadata.json", CRATE_PK),
        (f"s3://{CRATE_PK.bucket}/{CRATE_PK.path}?versionId=old", PhysicalKey(CRATE_PK.bucket, CRATE_PK.path, "new")),
    ],
    ids=["other-object", "other-version"],
)
def test_parse_crate_part_does_not_displace_provenance(part_id, crate_pk):
    """The provenance entry is the crate that was read; anything else there is a conflict."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": part_id})
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        parse(doc, crate_pk)
    assert excinfo.value.name == "RoCrateDuplicateEntry"
    assert excinfo.value.context == {"logical_key": "ro-crate-metadata.json"}


def test_parse_crate_self_reference_keeps_read_version():
    """A part naming the crate at the version being read is the same object, not a conflict."""
    versioned = PhysicalKey(CRATE_PK.bucket, CRATE_PK.path, "v1")
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"].append({"@id": f"s3://{CRATE_PK.bucket}/{CRATE_PK.path}?versionId=v1"})
    crate = parse(doc, versioned)
    assert crate.entries[-1].physical_key == versioned


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
    entry = parse(doc).entries[0]
    assert entry.logical_key == logical_key
    assert entry.physical_key == PhysicalKey("bucket", path, None)


def test_package_prefix_profile_example(mocker, packager_stubs):
    """End to end, the profile's example crate becomes the profile's example package metadata."""
    get_object_stub(mocker, PROFILE_EXAMPLE)

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/runs/2026-09-08-assay-01/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/runs/2026-09-08-assay-01/ro-crate-metadata.json",
            }
        ),
        None,
    )

    pkg, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "assay-dev/2026-09-08-assay-01"
    assert pkg.meta == {"package_name": "assay-dev/2026-09-08-assay-01", **PROFILE_PROJECTION}
    assert sorted(lk for lk, _ in pkg.walk()) == ["01-Well-A1.fcs", "ro-crate-metadata.json"]
    assert pkg["01-Well-A1.fcs"].meta["dateCreated"] == "2026-09-08T20:57:29Z"


def test_package_prefix_crate_with_utf8_bom(mocker, packager_stubs):
    """The profile forbids a BOM but asks consumers to decode defensively; PowerShell adds one."""
    mocker.patch.object(
        t4_lambda_pkgpush.s3,
        "get_object",
        return_value={"Body": io.BytesIO(b"\xef\xbb\xbf" + json.dumps(PROFILE_EXAMPLE).encode())},
    )

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/runs/2026-09-08-assay-01/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/runs/2026-09-08-assay-01/ro-crate-metadata.json",
            }
        ),
        None,
    )

    _, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "assay-dev/2026-09-08-assay-01"


def test_parse_pre_profile_emitter():
    """A pre-profile emitter parses, and its unreachable instrument is dropped, not guessed.

    `instrument` is projected from the acquisition actions the root `mentions`. This
    crate states the same instrument on each File's `isBasedOn` and lists no
    `mentions`, so the role is absent from package metadata while the reference
    survives verbatim in entry metadata.
    """
    doc = json.loads(PRE_PROFILE_PATH.read_text())
    crate_pk = PhysicalKey("bucket", "experiments/20260214_jdoe/ro-crate-metadata.json", "v1")

    assert rocrate.is_rocrate(doc)
    crate = rocrate.parse(doc, crate_pk, "experiments/20260214_jdoe")

    # A bare root name does not name the package; the caller's default stands.
    assert crate.package_name == "experiments/20260214_jdoe"
    validate_package_name(crate.package_name)
    assert crate.user_meta == {
        "creator": ["jdoe"],
        "producer": ["Assay Development", "Laboratory Operations"],
    }

    entries = {e.logical_key: e for e in crate.entries}
    assert sorted(entries) == ["01-Well-A1.fcs", "01-Well-A2.fcs", "ro-crate-metadata.json"]
    assert entries["01-Well-A1.fcs"].user_meta == {
        "dateCreated": "2026-02-14T20:33:09Z",
        "dateModified": "2026-02-14T22:06:57Z",
        "creator": {"@id": "#person-jdoe"},
        "isBasedOn": {"@id": "#instrument-cytometer-001"},
    }


def test_parse_canonical_nf_prov_wrroc():
    """The canonical nf-prov WRROC parses; its root hasPart becomes the package."""
    doc = json.loads(WRROC_PATH.read_text())
    crate_pk = PhysicalKey(
        "quilt-example-bucket", "example/wrroc/ro-crate-metadata.json", "ez_H9dTk41yptiJoVaLRL1SIduvvmu33"
    )

    assert rocrate.is_rocrate(doc)
    crate = rocrate.parse(doc, crate_pk, "example/wrroc")

    # It names no package, so the caller's default stands.
    assert crate.package_name == "example/wrroc"

    entries = {e.logical_key: e for e in crate.entries}
    # Every root hasPart except the license web URI, plus the crate itself.
    assert sorted(entries) == [
        "README.md",
        "fastp/test.fastp.html",
        "fastp/test.fastp.json",
        "fastp/test.fastp.log",
        "fastp/test_1.fastp.fastq.gz",
        "fastp/test_2.fastp.fastq.gz",
        "main.nf",
        "megahit/intermediate_contigs/k51.addi.fa.gz",
        "megahit/intermediate_contigs/k51.contigs.fa.gz",
        "megahit/intermediate_contigs/k51.final.contigs.fa.gz",
        "megahit/intermediate_contigs/k51.local.fa.gz",
        "megahit/intermediate_contigs/k71.addi.fa.gz",
        "megahit/intermediate_contigs/k71.contigs.fa.gz",
        "megahit/intermediate_contigs/k71.final.contigs.fa.gz",
        "megahit/test.contigs.fa.gz",
        "megahit/test.log",
        "nextflow.config",
        "nextflow_schema.json",
        "read1.fq.gz",
        "read2.fq.gz",
        "ro-crate-metadata.json",
    ]
    assert not any(e.is_dir for e in crate.entries)
    # Relative parts resolve against the crate folder; absolute s3:// parts stand alone.
    assert entries["main.nf"].physical_key == PhysicalKey("quilt-example-bucket", "example/wrroc/main.nf", None)
    assert entries["read1.fq.gz"].physical_key == PhysicalKey("quilt-example-bucket", "test/wrroc/read1.fq.gz", None)
    assert entries["ro-crate-metadata.json"].physical_key == crate_pk
    assert entries["README.md"].user_meta == {
        "description": "The README file of the workflow.",
        "encodingFormat": "text/markdown",
    }

    # Its actions are reachable through mentions, so their instruments (software, in a
    # workflow run) are projected; it states author rather than creator, so no creator.
    assert crate.user_meta == {"instrument": ["famosab/wrroc-meta-test", "fastp", "megahit", "Nextflow 24.10.4"]}


def test_package_prefix_canonical_nf_prov_wrroc(mocker, packager_stubs):
    get_object_stub(mocker, json.loads(WRROC_PATH.read_text()))
    list_prefix = mocker.patch.object(t4_lambda_pkgpush, "list_prefix_latest_versions")

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://quilt-example-bucket/example/wrroc/ro-crate-metadata.json",
                "metadata_uri": "s3://quilt-example-bucket/example/wrroc/ro-crate-metadata.json",
            }
        ),
        None,
    )

    list_prefix.assert_not_called()
    pkg, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "example/wrroc"
    assert len(list(pkg.walk())) == 21
    assert pkg["main.nf"].physical_key == PhysicalKey("quilt-example-bucket", "example/wrroc/main.nf", None)
    assert pkg["read2.fq.gz"].physical_key == PhysicalKey("quilt-example-bucket", "test/wrroc/read2.fq.gz", None)
    assert pkg["ro-crate-metadata.json"].meta == {}


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


def test_package_prefix_pre_profile_emitter(mocker, packager_stubs):
    """End to end on a pre-profile emitter: crate mode, no folder sweep, per-file meta."""
    doc = json.loads(PRE_PROFILE_PATH.read_text())
    get_object_stub(mocker, doc)
    list_prefix = mocker.patch.object(t4_lambda_pkgpush, "list_prefix_latest_versions")

    t4_lambda_pkgpush.package_prefix(
        json.dumps(
            {
                "source_prefix": "s3://bucket/experiments/20260214_jdoe/ro-crate-metadata.json",
                "metadata_uri": "s3://bucket/experiments/20260214_jdoe/ro-crate-metadata.json",
            }
        ),
        None,
    )

    # hasPart replaces the sweep, so an unlisted sibling object stays out of the package.
    list_prefix.assert_not_called()
    pkg, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "experiments/20260214_jdoe"
    assert pkg.meta == {
        "package_name": "experiments/20260214_jdoe",
        "creator": ["jdoe"],
        "producer": ["Assay Development", "Laboratory Operations"],
    }
    assert sorted(lk for lk, _ in pkg.walk()) == [
        "01-Well-A1.fcs",
        "01-Well-A2.fcs",
        "ro-crate-metadata.json",
    ]
    assert pkg["01-Well-A2.fcs"].meta == {
        "dateCreated": "2026-02-14T20:41:02Z",
        "dateModified": "2026-02-14T22:07:11Z",
        "creator": {"@id": "#person-jdoe"},
        "isBasedOn": {"@id": "#instrument-cytometer-001"},
    }


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
    assert pkg.meta == {"package_name": "ale/260908_ale_ELNID", **EXPECTED_META}
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
    user_s3 = mocker.patch.object(t4_lambda_pkgpush, "get_user_s3_client").return_value
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

    # One client, built once and reused across prefixes.
    list_prefix.assert_called_once_with("bucket", "experiments/260908_ale_ELNID/out/", user_s3)
    pkg, _ = built_package(packager_stubs)
    assert sorted(lk for lk, _ in pkg.walk()) == ["out/a.csv", "out/b.csv", "ro-crate-metadata.json"]
    assert pkg["out/a.csv"].physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/out/a.csv", "va")
    assert pkg["out/a.csv"].meta == {}
    # Listed explicitly and covered by the prefix: keeps its crate metadata, and keeps the
    # version the sweep pinned so its snapshot matches out/a.csv's.
    assert pkg["out/b.csv"].physical_key == PhysicalKey("bucket", "experiments/260908_ale_ELNID/out/b.csv", "vb")
    assert pkg["out/b.csv"].meta == {"dateCreated": "2026-01-01"}


def test_package_prefix_crate_mode_name_fallbacks(mocker, packager_stubs):
    doc = crate_without("#quilt-namespace")
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

    pkg, kwargs = built_package(packager_stubs)
    assert kwargs["name"] == "explicit/name"
    # The metadata records the name the package was published under, not the crate's.
    assert pkg.meta["package_name"] == "explicit/name"


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


def test_package_prefix_dir_list_denied_is_pkgpush_exception(mocker, packager_stubs):
    """A crate may name a bucket the caller cannot list; that surfaces structurally."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "out/"}]
    get_object_stub(mocker, doc)
    mocker.patch.object(t4_lambda_pkgpush, "get_user_s3_client")
    mocker.patch.object(
        t4_lambda_pkgpush,
        "list_prefix_latest_versions",
        side_effect=botocore.exceptions.ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "denied"}}, "ListObjectVersions"
        ),
    )

    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
        t4_lambda_pkgpush.package_prefix(
            json.dumps(
                {
                    "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                    "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                }
            ),
            None,
        )
    assert excinfo.value.name == "RoCrateFailedToListPrefix"
    assert excinfo.value.context["logical_key"] == "out/"


def test_package_prefix_dir_list_failing_mid_listing_is_pkgpush_exception(mocker, packager_stubs):
    """The listing is consumed lazily, so a page that fails after the first still surfaces structurally."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "out/"}]
    get_object_stub(mocker, doc)
    mocker.patch.object(t4_lambda_pkgpush, "get_user_s3_client")

    def listing(*args):
        yield {"Key": "experiments/260908_ale_ELNID/out/a.csv", "Size": 1, "VersionId": "va"}
        raise botocore.exceptions.ClientError({"Error": {"Code": "AccessDenied", "Message": "denied"}}, "List")

    mocker.patch.object(t4_lambda_pkgpush, "list_prefix_latest_versions", side_effect=listing)

    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
        t4_lambda_pkgpush.package_prefix(
            json.dumps(
                {
                    "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                    "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                }
            ),
            None,
        )
    assert excinfo.value.name == "RoCrateFailedToListPrefix"


def test_package_prefix_file_entity_inside_directory_part_keeps_meta(mocker, packager_stubs):
    """A File entity for an object a directory part expands to keeps its metadata, as a listed file does."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "out/"}]
    doc["@graph"] += [
        {"@id": "out/a.csv", "@type": "File", "name": "a.csv", "dateCreated": "2026-01-01"},
        # Outside every directory part, so it is not packaged and cannot fail the crate.
        {"@id": "elsewhere.csv", "@type": "File", "contentSize": float("nan")},
    ]
    mocker.patch.object(
        t4_lambda_pkgpush.s3,
        "get_object",
        return_value={"Body": io.BytesIO(json.dumps(doc).encode())},
    )
    mocker.patch.object(t4_lambda_pkgpush, "get_user_s3_client")
    mocker.patch.object(
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

    pkg, _ = built_package(packager_stubs)
    assert pkg["out/a.csv"].meta == {"dateCreated": "2026-01-01"}
    assert pkg["out/b.csv"].meta == {}


def test_parse_file_entity_inside_directory_part_rejects_non_json_meta():
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "out/"}]
    doc["@graph"].append({"@id": "out/a.csv", "@type": "File", "contentSize": float("nan")})
    with pytest.raises(rocrate.RoCrateError) as excinfo:
        parse(doc)
    assert excinfo.value.name == "RoCrateInvalidEntryMeta"


def test_package_prefix_file_and_dir_same_name_is_pkgpush_exception(mocker, packager_stubs):
    """A crate naming both "data" and "data/" cannot become one manifest."""
    doc = copy.deepcopy(SAMPLE)
    root_of(doc)["hasPart"] = [{"@id": "data/"}, {"@id": "data"}]
    doc["@graph"].append({"@id": "data", "@type": "File", "name": "data"})
    get_object_stub(mocker, doc)
    mocker.patch.object(t4_lambda_pkgpush, "get_user_s3_client")
    mocker.patch.object(
        t4_lambda_pkgpush,
        "list_prefix_latest_versions",
        return_value=[{"Key": "experiments/260908_ale_ELNID/data/x.csv", "Size": 1, "VersionId": "vx"}],
    )

    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
        t4_lambda_pkgpush.package_prefix(
            json.dumps(
                {
                    "source_prefix": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                    "metadata_uri": "s3://bucket/experiments/260908_ale_ELNID/ro-crate-metadata.json",
                }
            ),
            None,
        )
    assert excinfo.value.name == "InvalidLogicalKey"


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
