"""Tests for try_get_precomputed_from_head function."""

import base64

import pytest

from quilt3.data_transfer import CHECKSUM_MULTIPART_THRESHOLD
from quilt_shared.pkgpush import Checksum, ChecksumAlgorithm
from t4_lambda_pkgpush import try_get_precomputed_from_head


@pytest.mark.parametrize(
    "file_size, head_response, algorithms, expected",
    [
        # CRC64NVME - should be returned directly
        (
            CHECKSUM_MULTIPART_THRESHOLD + 1,
            {"ChecksumCRC64NVME": "KqUC/xZziak="},
            [ChecksumAlgorithm.CRC64NVME],
            Checksum.crc64nvme(base64.b64decode("KqUC/xZziak=")),
        ),
        # Small file with SHA256 - should compute sha2-256-chunked by double hashing
        (
            CHECKSUM_MULTIPART_THRESHOLD - 1,
            {"ChecksumSHA256": "MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="},
            [ChecksumAlgorithm.SHA256_CHUNKED],
            Checksum.sha256_chunked_from_parts([base64.b64decode("MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g=")]),
        ),
        # Large file with SHA256 - should return None (needs compliance checking)
        # THIS IS THE BUG CASE - we should NOT accept SHA256 for large files without validation
        (
            CHECKSUM_MULTIPART_THRESHOLD + 1,
            {"ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ="},
            [ChecksumAlgorithm.SHA256_CHUNKED],
            None,  # Should return None to trigger compliance checking in calculate_pkg_hashes
        ),
        # Priority order: CRC64NVME available, should be returned first
        (
            10 * 1024 * 1024,
            {
                "ChecksumCRC64NVME": "KqUC/xZziak=",
                "ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=",
            },
            [ChecksumAlgorithm.CRC64NVME, ChecksumAlgorithm.SHA256_CHUNKED],
            Checksum.crc64nvme(base64.b64decode("KqUC/xZziak=")),
        ),
        # Priority order: SHA256_CHUNKED first but large file, should skip and try CRC64NVME
        (
            10 * 1024 * 1024,
            {
                "ChecksumCRC64NVME": "KqUC/xZziak=",
                "ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ=",
            },
            [ChecksumAlgorithm.SHA256_CHUNKED, ChecksumAlgorithm.CRC64NVME],
            Checksum.crc64nvme(base64.b64decode("KqUC/xZziak=")),
        ),
        # No checksums available
        (
            10 * 1024 * 1024,
            {},
            [ChecksumAlgorithm.CRC64NVME, ChecksumAlgorithm.SHA256_CHUNKED],
            None,
        ),
        # Empty file with SHA256
        (
            0,
            {"ChecksumSHA256": "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="},
            [ChecksumAlgorithm.SHA256_CHUNKED],
            Checksum.sha256_chunked_from_parts([base64.b64decode("47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=")]),
        ),
    ],
)
def test_try_get_precomputed_from_head(file_size, head_response, algorithms, expected):
    """Test extraction of precomputed checksums from HeadObject response."""
    result = try_get_precomputed_from_head(head_response, file_size, algorithms)

    if expected is None:
        assert result is None
    else:
        assert result == expected


def test_large_sha256_not_accepted_without_compliance():
    """
    Regression test: Large files with SHA256 checksums should not be accepted
    from HeadObject without compliance validation via GetObjectAttributes.

    This test specifically catches the bug where non-compliant SHA256 checksums
    were incorrectly returned for large files.
    """

    # Should return None (will be validated later via GetObjectAttributes)
    result = try_get_precomputed_from_head(
        # HeadObject response with SHA256 checksum (could be non-compliant)
        {"ChecksumSHA256": "La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ="},
        # Large file
        CHECKSUM_MULTIPART_THRESHOLD + 1,
        # Request SHA256_CHUNKED
        [ChecksumAlgorithm.SHA256_CHUNKED],
    )
    assert result is None, (
        "Large files with SHA256 checksums should return None from try_get_precomputed_from_head() "
        "to trigger compliance validation in calculate_pkg_hashes()"
    )
