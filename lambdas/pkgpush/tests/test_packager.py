import pytest

import quilt3.util
import t4_lambda_pkgpush

DEFAULT_PKG_NAME_PREFIX = "quilt-packager"
DEFAULT_PKG_NAME_SUFFIX = "pkg"


@pytest.mark.parametrize(
    "prefix, expected",
    [
        ("", f"{DEFAULT_PKG_NAME_PREFIX}/{DEFAULT_PKG_NAME_SUFFIX}"),
        ("////", f"{DEFAULT_PKG_NAME_PREFIX}/{DEFAULT_PKG_NAME_SUFFIX}"),
        ("//f*0//", f"{DEFAULT_PKG_NAME_PREFIX}/f_0"),
        ("//f*0//b@r//", "f_0/b_r"),
        ("//f*0//b@r//b@z//", "b_r/b_z"),
    ],
)
def test_infer_pkg_name_from_prefix(prefix, expected):
    quilt3.util.validate_package_name(expected)

    assert t4_lambda_pkgpush.infer_pkg_name_from_prefix(prefix) == expected
