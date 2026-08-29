import dataclasses
import json
import re
from pathlib import Path

import pytest

from quilt3.uri import PackageUri, PackageUriError

CASES_PATH = Path(__file__).resolve().parents[3] / 'shared' / 'package_uri_cases.json'
CASES = json.loads(CASES_PATH.read_text(encoding='utf-8'))


@pytest.mark.parametrize('case', CASES['valid'], ids=lambda case: case['name'])
def test_parse_valid_package_uri(case):
    actual = {
        key: value for key, value in dataclasses.asdict(PackageUri.parse(case['uri'])).items() if value is not None
    }

    assert actual == case['value']


@pytest.mark.parametrize('case', CASES['invalid'], ids=lambda case: case['name'])
def test_parse_invalid_package_uri(case):
    with pytest.raises(PackageUriError, match=re.escape(case['error'])) as exc_info:
        PackageUri.parse(case['uri'])

    assert exc_info.value.uri == case['uri']
    assert exc_info.value.detail in str(exc_info.value)
