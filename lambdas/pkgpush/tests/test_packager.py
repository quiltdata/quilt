import pytest

import t4_lambda_pkgpush
from quilt3.util import PhysicalKey, validate_package_name

DEFAULT_PKG_NAME_PREFIX = "quilt-packager"
DEFAULT_PKG_NAME_SUFFIX = "pkg"


@pytest.mark.parametrize(
    "prefix, expected",
    [
        ("", f"{DEFAULT_PKG_NAME_PREFIX}/{DEFAULT_PKG_NAME_SUFFIX}"),
        ("////", f"{DEFAULT_PKG_NAME_PREFIX}/{DEFAULT_PKG_NAME_SUFFIX}"),
        ("//f*0//", f"{DEFAULT_PKG_NAME_PREFIX}/f_0"),
        ("//f*0//b@r//", "f_0/b_r"),
        ("//f*0//b@r//b@z//", "f_0_b_r/b_z"),
    ],
)
def test_infer_pkg_name_from_prefix(prefix, expected):
    validate_package_name(expected)

    assert t4_lambda_pkgpush.infer_pkg_name_from_prefix(prefix) == expected

@pytest.mark.parametrize(
    "source_prefix, expected_pk",
    [
        ("s3://bucket", PhysicalKey("bucket", "", None)),
        ("s3://bucket/", PhysicalKey("bucket", "", None)),
        ("s3://bucket/test/", PhysicalKey("bucket", "test/", None)),
        ("s3://bucket/test//", PhysicalKey("bucket", "test//", None)),
        ("s3://bucket/test//metadata.json?versionId=1", PhysicalKey("bucket", "test//", None)),
    ],
)
def test_get_source_prefix_pk(source_prefix, expected_pk):
    assert (
        t4_lambda_pkgpush.PackagerEvent(
            source_prefix=source_prefix,
            metadata_uri="s3://bucket/metadata.json",
        ).get_source_prefix_pk()
        == expected_pk
    )


@pytest.mark.parametrize(
    "source_prefix, metadata_uri, expected_pk",
    [
        ("s3://bucket/metadata.json", "other.json", PhysicalKey("bucket", "other.json", None)),
        ("s3://bucket/metadata.json", "//other-bucket/other.json", PhysicalKey("other-bucket", "other.json", None)),
        (
            "s3://bucket/metadata.json?versionId=1",
            "//other-bucket/other.json",
            PhysicalKey("other-bucket", "other.json", None),
        ),
        (
            "s3://bucket/metadata.json?versionId=1",
            "s3://other-bucket/other.json",
            PhysicalKey("other-bucket", "other.json", None),
        ),
        (
            "s3://bucket/metadata.json?versionId=1",
            "s3://other-bucket/other.json?versionId=2",
            PhysicalKey("other-bucket", "other.json", "2"),
        ),
    ],
)
def test_get_metadata_uri_pk(source_prefix, metadata_uri, expected_pk):
    assert (
        t4_lambda_pkgpush.PackagerEvent(
            source_prefix=source_prefix,
            metadata_uri=metadata_uri,
        ).get_metadata_uri_pk()
        == expected_pk
    )
