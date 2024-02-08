import base64
from unittest import mock

import pytest

from t4_lambda_s3hash import Checksum, ChecksumType, get_compliant_checksum


@pytest.mark.parametrize(
    "obj_attrs",
    [
        {},
        {"Checksum": {"ChecksumSHA1": "X94czmA+ZWbSDagRyci8zLBE1K4="}},
    ],
)
def test_no_sha256(obj_attrs):
    assert get_compliant_checksum(obj_attrs) is None


@pytest.mark.parametrize(
    "obj_attrs, sp, mp",
    [
        (
            {
                "Checksum": {"ChecksumSHA256": "MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="},
                "ObjectSize": 1048576,
            },
            Checksum.singlepart(base64.b64decode("MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g=")),
            Checksum.singlepart(base64.b64decode("MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g=")),
        ),
        (
            {
                "Checksum": {"ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ="},
                "ObjectSize": 8388608,
            },
            Checksum.singlepart(base64.b64decode("La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=")),
            None,
        ),
        (
            {
                "Checksum": {"ChecksumSHA256": "MIsGKY+ykqN4CPj3gGGu4Gv03N7OWKWpsZqEf+OrGJs="},
                "ObjectParts": {
                    "TotalPartsCount": 1,
                    "PartNumberMarker": 0,
                    "NextPartNumberMarker": 1,
                    "MaxParts": 1000,
                    "IsTruncated": False,
                    "Parts": [
                        {
                            "PartNumber": 1,
                            "Size": 8388608,
                            "ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=",
                        }
                    ],
                },
                "ObjectSize": 8388608,
            },
            Checksum.singlepart(base64.b64decode("La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=")),
            Checksum(type=ChecksumType.MP, value="MIsGKY+ykqN4CPj3gGGu4Gv03N7OWKWpsZqEf+OrGJs=-1"),
        ),
        (
            {
                "Checksum": {"ChecksumSHA256": "nlR6I2vcFqpTXrJSmMglmCYoByajfADbDQ6kESbPIlE="},
                "ObjectParts": {
                    "TotalPartsCount": 2,
                    "PartNumberMarker": 0,
                    "NextPartNumberMarker": 2,
                    "MaxParts": 1000,
                    "IsTruncated": False,
                    "Parts": [
                        {
                            "PartNumber": 1,
                            "Size": 5242880,
                            "ChecksumSHA256": "wDbLt1U6kJ+LiHfURhkkMH8n7LZs/5KO7q/VacOIfik=",
                        },
                        {
                            "PartNumber": 2,
                            "Size": 8388608,
                            "ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=",
                        },
                    ],
                },
                "ObjectSize": 13631488,
            },
            None,
            None,
        ),
        (
            {
                "Checksum": {"ChecksumSHA256": "bGeobZC1xyakKeDkOLWP9khl+vuOditELvPQhrT/R9M="},
                "ObjectParts": {
                    "TotalPartsCount": 2,
                    "PartNumberMarker": 0,
                    "NextPartNumberMarker": 2,
                    "MaxParts": 1000,
                    "IsTruncated": False,
                    "Parts": [
                        {
                            "PartNumber": 1,
                            "Size": 8388608,
                            "ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=",
                        },
                        {
                            "PartNumber": 2,
                            "Size": 5242880,
                            "ChecksumSHA256": "wDbLt1U6kJ+LiHfURhkkMH8n7LZs/5KO7q/VacOIfik=",
                        },
                    ],
                },
                "ObjectSize": 13631488,
            },
            None,
            Checksum(type=ChecksumType.MP, value="bGeobZC1xyakKeDkOLWP9khl+vuOditELvPQhrT/R9M=-2"),
        ),
    ],
)
def test_single_part(obj_attrs, sp, mp):
    with mock.patch("t4_lambda_s3hash.MULTIPART_CHECKSUMS", False):
        assert get_compliant_checksum(obj_attrs) == sp

    with mock.patch("t4_lambda_s3hash.MULTIPART_CHECKSUMS", True):
        assert get_compliant_checksum(obj_attrs) == mp
