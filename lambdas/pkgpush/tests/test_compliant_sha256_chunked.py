"""Tests for try_get_compliant_sha256_chunked function."""

import base64
from unittest import mock

import pytest

from quilt_shared.pkgpush import Checksum
from t4_lambda_pkgpush import try_get_compliant_sha256_chunked


class FakePhysicalKey:
    """Minimal PhysicalKey for testing."""

    def __init__(self, bucket, path, version_id=None):
        self.bucket = bucket
        self.path = path
        self.version_id = version_id


@pytest.mark.parametrize(
    "file_size, attrs, expected",
    [
        # Small file - should return None (handled by HeadObject optimization)
        (
            1048576,  # 1 MiB < MIN_PART_SIZE
            {
                "Checksum": {"ChecksumSHA256": "MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="},
                "ObjectSize": 1048576,
            },
            None,
        ),
        # No SHA256 checksum
        (
            8388608,  # 8 MiB
            {
                "Checksum": {"ChecksumSHA1": "X94czmA+ZWbSDagRyci8zLBE1K4="},
                "ObjectSize": 8388608,
            },
            None,
        ),
        # No ObjectParts
        (
            8388608,  # 8 MiB
            {
                "Checksum": {"ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ="},
                "ObjectSize": 8388608,
            },
            None,
        ),
        # Single part with correct size
        (
            8388608,  # 8 MiB
            {
                "Checksum": {"ChecksumSHA256": "MIsGKY+ykqN4CPj3gGGu4Gv03N7OWKWpsZqEf+OrGJs="},
                "ObjectParts": {
                    "TotalPartsCount": 1,
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
            Checksum.sha256_chunked(base64.b64decode("MIsGKY+ykqN4CPj3gGGu4Gv03N7OWKWpsZqEf+OrGJs=")),
        ),
        # Two parts with correct sizes (8 MiB + 5 MiB)
        (
            13631488,  # 8 MiB + 5 MiB
            {
                "Checksum": {"ChecksumSHA256": "bGeobZC1xyakKeDkOLWP9khl+vuOditELvPQhrT/R9M="},
                "ObjectParts": {
                    "TotalPartsCount": 2,
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
            Checksum.sha256_chunked(base64.b64decode("bGeobZC1xyakKeDkOLWP9khl+vuOditELvPQhrT/R9M=")),
        ),
        # Non-compliant parts (wrong sizes)
        (
            13631488,  # 8 MiB + 5 MiB expected
            {
                "Checksum": {"ChecksumSHA256": "nlR6I2vcFqpTXrJSmMglmCYoByajfADbDQ6kESbPIlE="},
                "ObjectParts": {
                    "TotalPartsCount": 2,
                    "Parts": [
                        {
                            "PartNumber": 1,
                            "Size": 5242880,  # Wrong - should be 8388608
                            "ChecksumSHA256": "wDbLt1U6kJ+LiHfURhkkMH8n7LZs/5KO7q/VacOIfik=",
                        },
                        {
                            "PartNumber": 2,
                            "Size": 8388608,  # Wrong - should be 5242880
                            "ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=",
                        },
                    ],
                },
                "ObjectSize": 13631488,
            },
            None,
        ),
        # Truncated parts (missing parts)
        (
            16777216,  # 16 MiB
            {
                "Checksum": {"ChecksumSHA256": "somevalue"},
                "ObjectParts": {
                    "TotalPartsCount": 2,
                    "Parts": [
                        {
                            "PartNumber": 1,
                            "Size": 8388608,
                            "ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=",
                        }
                    ],  # Missing part 2
                },
                "ObjectSize": 16777216,
            },
            None,
        ),
    ],
)
def test_try_get_compliant_sha256_chunked(file_size, attrs, expected):
    """Test compliance checking for SHA256_CHUNKED checksums."""
    pk = FakePhysicalKey("test-bucket", "test-key")
    s3_client = mock.Mock()
    s3_client.get_object_attributes.return_value = attrs

    result = try_get_compliant_sha256_chunked(s3_client, pk, file_size)

    if expected is None:
        assert result is None
    else:
        assert result == expected


def test_client_error_returns_none():
    """Test that ClientError returns None."""
    from botocore.exceptions import ClientError

    pk = FakePhysicalKey("test-bucket", "test-key")
    s3_client = mock.Mock()
    s3_client.get_object_attributes.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied"}}, "GetObjectAttributes"
    )

    result = try_get_compliant_sha256_chunked(s3_client, pk, 8388608)
    assert result is None
