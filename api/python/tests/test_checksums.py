"""Tests for quilt3.checksums module."""

import pytest

from quilt3 import checksums

# --- Utility functions ---


@pytest.mark.parametrize(
    "size, expected",
    [
        (0, False),
        (1024, False),
        (checksums.CHECKSUM_MULTIPART_THRESHOLD - 1, False),
        (checksums.CHECKSUM_MULTIPART_THRESHOLD, True),
        (checksums.CHECKSUM_MULTIPART_THRESHOLD + 1, True),
        (100 * 1024 * 1024, True),
    ],
)
def test_is_mpu(size, expected):
    assert checksums.is_mpu(size) is expected


def test_crc64nvme_to_bytes():
    # CRC64NVME of b'Hello, World!' is 15323988402725835341
    crc = 15323988402725835341
    result = checksums.crc64nvme_to_bytes(crc)
    assert result == b"\xd4\xa9\xbeC&\xad\xd2M"
    assert len(result) == 8


def test_crc64nvme_to_bytes_zero():
    result = checksums.crc64nvme_to_bytes(0)
    assert result == b"\x00" * 8


def test_simple_s3_to_quilt_checksum():
    # S3 returns base64(sha256(data))
    # Quilt wants base64(sha256(sha256(data)))
    s3_checksum = "3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8="
    expected_quilt = "BCp9ZKWB7y7pg/IQWIAcw1ZjtwXmxV9i+o4PGOzHCYk="

    result = checksums._simple_s3_to_quilt_checksum(s3_checksum)
    assert result == expected_quilt


def test_simple_s3_to_quilt_checksum_empty_file():
    # Edge case: empty file checksum should NOT be double-hashed
    empty_sha256_b64 = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="

    result = checksums._simple_s3_to_quilt_checksum(empty_sha256_b64)
    # Should return the same checksum, not hash it again
    assert result == empty_sha256_b64


def test_legacy_calculate_checksum_bytes():
    data = b"Hello, World!"
    expected = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"

    result = checksums.legacy_calculate_checksum_bytes(data)
    assert result == expected


def test_legacy_calculate_checksum_bytes_empty():
    result = checksums.legacy_calculate_checksum_bytes(b"")
    assert result == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


# --- Calculator registry ---


@pytest.mark.parametrize(
    "hash_type, expected_cls",
    [
        (checksums.SHA256_CHUNKED_HASH_NAME, checksums.SHA256MultiPartChecksumCalculator),
        (checksums.CRC64NVME_HASH_NAME, checksums.CRC64NVMEMultiPartChecksumCalculator),
    ],
)
def test_get_calculator_cls(hash_type, expected_cls):
    cls = checksums.MultiPartChecksumCalculator.get_calculator_cls(hash_type)
    assert cls is expected_cls


def test_get_calculator_cls_invalid():
    with pytest.raises(ValueError, match="Unsupported checksum type"):
        checksums.MultiPartChecksumCalculator.get_calculator_cls("invalid-type")


# --- SHA256 calculator ---


def test_sha256_calculator_single_part():
    data = b"Hello, World!"
    calc = checksums.SHA256MultiPartChecksumCalculator()
    calc.update(data)
    part = calc.digest(len(data))

    assert part.size == len(data)
    # SHA256 of b'Hello, World!'
    assert (
        part.checksum == b"\xdf\xfd`!\xbb+\xd5\xb0\xafgb\x90\x80\x9e\xc3\xa51\x91\xdd\x81\xc7\xf7\nK(h\x8a6!\x82\x98o"
    )


def test_sha256_calculator_combine_parts():
    part1_data = b"Hello, "
    part2_data = b"World!"

    calc1 = checksums.SHA256MultiPartChecksumCalculator()
    calc1.update(part1_data)
    part1 = calc1.digest(len(part1_data))

    calc2 = checksums.SHA256MultiPartChecksumCalculator()
    calc2.update(part2_data)
    part2 = calc2.digest(len(part2_data))

    result = checksums.SHA256MultiPartChecksumCalculator.combine_parts([part1, part2])

    # base64(sha256(sha256(part1) + sha256(part2)))
    assert result == "JOdgH0Fd8jE6VYm2X4bSvVd2ijQ41+Wt6X0k45mIs0E="


def test_sha256_calculator_empty_parts():
    result = checksums.SHA256MultiPartChecksumCalculator.combine_parts([])
    # base64(sha256(b''))
    assert result == "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="


# --- CRC64NVME calculator ---


def test_crc64nvme_calculator_single_part():
    data = b"Hello, World!"
    calc = checksums.CRC64NVMEMultiPartChecksumCalculator()
    calc.update(data)
    part = calc.digest(len(data))

    assert part.size == len(data)
    assert part.checksum == 15323988402725835341


def test_crc64nvme_calculator_update_incremental():
    # Updating incrementally should produce same result as updating all at once
    data = b"Hello, World!"

    calc1 = checksums.CRC64NVMEMultiPartChecksumCalculator()
    calc1.update(data)

    calc2 = checksums.CRC64NVMEMultiPartChecksumCalculator()
    calc2.update(b"Hello, ")
    calc2.update(b"World!")

    assert calc1._get_checksum() == calc2._get_checksum()


def test_crc64nvme_calculator_combine_parts():
    part1_data = b"Hello, "
    part2_data = b"World!"

    calc1 = checksums.CRC64NVMEMultiPartChecksumCalculator()
    calc1.update(part1_data)
    part1 = calc1.digest(len(part1_data))

    calc2 = checksums.CRC64NVMEMultiPartChecksumCalculator()
    calc2.update(part2_data)
    part2 = calc2.digest(len(part2_data))

    result = checksums.CRC64NVMEMultiPartChecksumCalculator.combine_parts([part1, part2])

    # Expected: base64 of CRC64NVME of full data
    assert result == "1Km+Qyat0k0="


def test_crc64nvme_calculator_combine_empty_parts():
    result = checksums.CRC64NVMEMultiPartChecksumCalculator.combine_parts([])
    # CRC64NVME of empty is 0
    assert result == "AAAAAAAAAAA="


# --- High-level checksum functions ---


def test_calculate_multipart_checksum_bytes_sha256():
    data = b"Hello, World!"
    result = checksums.calculate_multipart_checksum_bytes(data, checksum_type=checksums.SHA256_CHUNKED_HASH_NAME)

    # For small data (single part), it's base64(sha256(sha256(data)))
    assert result == "BCp9ZKWB7y7pg/IQWIAcw1ZjtwXmxV9i+o4PGOzHCYk="


def test_calculate_multipart_checksum_bytes_crc64nvme():
    data = b"Hello, World!"
    result = checksums.calculate_multipart_checksum_bytes(data, checksum_type=checksums.CRC64NVME_HASH_NAME)
    assert result == "1Km+Qyat0k0="


def test_calculate_multipart_checksum_bytes_crc64nvme_empty():
    result = checksums.calculate_multipart_checksum_bytes(b"", checksum_type=checksums.CRC64NVME_HASH_NAME)
    assert result == "AAAAAAAAAAA="


def test_calculate_multipart_checksum_bytes_crc64nvme_multipart():
    """Test CRC64NVME with data spanning multiple chunks (18MB = 3 chunks of 8MB)."""
    data = b"1234567890abcdefgh" * 1024 * 1024  # 18MB
    assert len(data) > checksums.CHECKSUM_MULTIPART_THRESHOLD

    result = checksums.calculate_multipart_checksum_bytes(data, checksum_type=checksums.CRC64NVME_HASH_NAME)
    assert result == "kpoJFZYSwt4="


def test_calculate_multipart_checksum_bytes_crc64nvme_one_part():
    """Test CRC64NVME with data exactly at threshold (8MB = 1 part multipart)."""
    data = b"12345678" * 1024 * 1024  # 8MB exactly
    assert len(data) == checksums.CHECKSUM_MULTIPART_THRESHOLD

    result = checksums.calculate_multipart_checksum_bytes(data, checksum_type=checksums.CRC64NVME_HASH_NAME)
    assert result == "rGEwZFw0JFo="
