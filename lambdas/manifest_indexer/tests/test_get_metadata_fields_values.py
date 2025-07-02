import datetime
import json

import pytest

from t4_lambda_manifest_indexer import MAX_KEYWORD_LEN, get_metadata_fields

TEXT_VALUE = (MAX_KEYWORD_LEN + 1) * "a"
KEYWORD_VALUE = "a"


@pytest.mark.parametrize(
    "src_value, expected_field",
    [
        (
            TEXT_VALUE,
            {
                "type": "text",
                "text": TEXT_VALUE,
            },
        ),
        (
            [TEXT_VALUE, TEXT_VALUE],
            {
                "type": "text",
                "text": [TEXT_VALUE, TEXT_VALUE],
            },
        ),
        (
            [KEYWORD_VALUE, KEYWORD_VALUE],
            {
                "type": "keyword",
                "keyword": [KEYWORD_VALUE, KEYWORD_VALUE],
                "text": json.dumps([KEYWORD_VALUE, KEYWORD_VALUE], separators=(",", ":")),
            },
        ),
        (
            [KEYWORD_VALUE, TEXT_VALUE],
            {
                "type": "text",
                "text": [KEYWORD_VALUE, TEXT_VALUE],
            },
        ),
        (
            1,
            {
                "type": "double",
                "text": json.dumps(1),
                "double": 1,
            },
        ),
        (
            1.2,
            {
                "type": "double",
                "text": json.dumps(1.2),
                "double": 1.2,
            },
        ),
        (
            "2023-10-13T09:10:23.873434",
            {
                "type": "date",
                "text": json.dumps("2023-10-13T09:10:23.873434"),
                "date": datetime.datetime(2023, 10, 13, 9, 10, 23, 873434),
            },
        ),
        (
            "2023-10-13T09:10:23.873434Z",
            {
                "type": "date",
                "text": json.dumps("2023-10-13T09:10:23.873434Z"),
                "date": datetime.datetime(2023, 10, 13, 9, 10, 23, 873434),
            },
        ),
        (
            True,
            {
                "type": "boolean",
                "text": json.dumps(True),
                "boolean": True,
            },
        ),
    ],
)
def test_get_metadata_fields_values(src_value, expected_field):
    field_name = "a"

    assert get_metadata_fields(
        {
            field_name: src_value,
        }
    ) == [
        {
            "json_pointer": f"/{field_name}",
            **expected_field,
        }
    ]


@pytest.mark.parametrize(
    "src_value",
    [
        None,
        [1, TEXT_VALUE],
    ],
)
def test_get_metadata_fields_values_ignored(src_value):
    field_name = "a"

    assert (
        get_metadata_fields(
            {
                field_name: src_value,
            }
        )
        == []
    )


@pytest.mark.parametrize(
    "metadata, expected_json_pointer",
    [
        (
            {
                "a": TEXT_VALUE,
            },
            "/a",
        ),
        (
            {
                "a": {
                    "a": TEXT_VALUE,
                },
            },
            "/a/a",
        ),
        (
            {
                "a.a": TEXT_VALUE,
            },
            "/a.a",
        ),
        (
            {
                "a/a": TEXT_VALUE,
            },
            "/a~1a",
        ),
    ],
)
def test_get_metadata_fields_json_pointer(metadata, expected_json_pointer):
    (field,) = get_metadata_fields(metadata)
    assert field["json_pointer"] == expected_json_pointer
