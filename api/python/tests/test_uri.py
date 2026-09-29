import dataclasses
import json
import re
from pathlib import Path

import pytest

from quilt3.uri import PackageUri, PackageUriError, is_package_uri

CASES_PATH = Path(__file__).resolve().parents[3] / 'shared' / 'package_uri_cases.json'
CASES = json.loads(CASES_PATH.read_text(encoding='utf-8'))


@pytest.mark.parametrize('case', CASES['valid'], ids=lambda case: case['name'])
def test_parse_valid_package_uri(case):
    actual = {
        key: value for key, value in dataclasses.asdict(PackageUri.parse(case['uri'])).items() if value is not None
    }

    assert actual == case['value']


@pytest.mark.parametrize(
    'value, expected',
    [
        ('quilt+s3://bucket#package=quilt/test', True),
        ('QUILT+S3://bucket#package=quilt/test', True),
        ('Quilt+S3://bucket#package=quilt/test', True),
        ('quilt/test', False),
        ('s3://bucket', False),
        (None, False),
    ],
)
def test_is_package_uri_ignores_scheme_case(value, expected):
    # URI schemes are case-insensitive; a miss here routes the URI to legacy
    # package-name handling instead.
    assert is_package_uri(value) is expected


@pytest.mark.parametrize('case', CASES['invalid'], ids=lambda case: case['name'])
def test_parse_invalid_package_uri(case):
    with pytest.raises(PackageUriError, match=re.escape(case['error'])) as exc_info:
        PackageUri.parse(case['uri'])

    assert exc_info.value.uri == case['uri']
    assert exc_info.value.detail in str(exc_info.value)
