"""Tests for CRC64-NVME checksum utilities."""

import pytest

from quilt_shared.crc64 import combine_crc64nvme, crc64_extend


def test_extend_zero_bytes():
    """Extending by 0 bytes returns unchanged CRC."""
    crc = 0x123456789ABCDEF0
    assert crc64_extend(crc, 0) == crc


def test_extend_additive():
    """Extending by (a + b) equals extending by a then b."""
    crc = 0x123456789ABCDEF0
    a, b = 100, 200

    result_combined = crc64_extend(crc, a + b)
    result_step = crc64_extend(crc64_extend(crc, a), b)

    assert result_combined == result_step


def test_extend_large_offset():
    """Handles multi-GiB offsets efficiently (O(log n) performance)."""
    crc = 0x1234567890ABCDEF
    large_offset = 5 * 1024**3  # 5 GiB (AWS S3 max part size)
    result = crc64_extend(crc, large_offset)
    assert 0 <= result < (1 << 64)


def test_extend_validation():
    """Input validation: negative data_len, out-of-range CRC."""
    # Negative data_len
    with pytest.raises(ValueError, match="data_len must be non-negative"):
        crc64_extend(0, -1)

    # Invalid CRC (negative)
    with pytest.raises(ValueError, match="crc must be 64-bit unsigned"):
        crc64_extend(-1, 100)

    # Invalid CRC (too large)
    with pytest.raises(ValueError, match="crc must be 64-bit unsigned"):
        crc64_extend(1 << 64, 100)


def test_combine_empty_parts():
    """Empty parts list returns zero CRC."""
    assert combine_crc64nvme([], []) == b"\x00" * 8


def test_combine_single_part():
    """Single part returns unchanged."""
    part_crc = b"\x12\x34\x56\x78\x9a\xbc\xde\xf0"
    assert combine_crc64nvme([part_crc], [1024]) == part_crc


def test_combine_two_parts():
    """Combining two parts produces different result."""
    part_crcs = [b"\x00\x00\x00\x00\x00\x00\x00\x01", b"\x00\x00\x00\x00\x00\x00\x00\x02"]
    part_sizes = [8 * 1024 * 1024, 8 * 1024 * 1024]

    result = combine_crc64nvme(part_crcs, part_sizes)

    assert len(result) == 8
    assert result != part_crcs[0]
    assert result != part_crcs[1]


def test_combine_order_matters():
    """Part order affects the result."""
    part_crcs = [b"\x00\x00\x00\x00\x00\x00\x00\x01", b"\x00\x00\x00\x00\x00\x00\x00\x02"]
    part_sizes = [1024, 2048]

    forward = combine_crc64nvme(part_crcs, part_sizes)
    reversed = combine_crc64nvme([part_crcs[1], part_crcs[0]], [part_sizes[1], part_sizes[0]])

    assert forward != reversed


def test_combine_mismatched_lengths():
    """Mismatched inputs raise ValueError."""
    with pytest.raises(ValueError, match="must have the same length"):
        combine_crc64nvme([b"\x00" * 8, b"\x01" * 8], [1024])


def test_combine_many_parts():
    """Handles 640 parts efficiently (~5 GiB file)."""
    parts = 640
    part_crcs = [(i % 256).to_bytes(1, byteorder='big') + b"\x00" * 7 for i in range(parts)]
    part_sizes = [2**23] * parts

    result = combine_crc64nvme(part_crcs, part_sizes)
    assert len(result) == 8


def test_combine_known_values():
    """Test with known CRC64NVME values from actual computation.

    - CRC64NVME("dead") = ed14e5405da3358b
    - CRC64NVME("beef") = 36acfe7d35bf83a2
    - CRC64NVME("deadbeef") = 356a0238d2757b0f

    Combining "dead" + "beef" should produce "deadbeef".
    """
    part1_crc = bytes.fromhex("ed14e5405da3358b")  # CRC of "dead" (4 bytes)
    part2_crc = bytes.fromhex("36acfe7d35bf83a2")  # CRC of "beef" (4 bytes)
    expected = bytes.fromhex("356a0238d2757b0f")  # CRC of "deadbeef" (8 bytes)

    result = combine_crc64nvme([part1_crc, part2_crc], [4, 4])

    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"


def test_combine_associative():
    """Combining parts is associative: tests both (A+B)+C and A+(B+C)."""
    part_a = bytes.fromhex("1111111111111111")
    part_b = bytes.fromhex("2222222222222222")
    part_c = bytes.fromhex("3333333333333333")
    size_a, size_b, size_c = 1024, 2048, 4096

    # Combine all at once
    result_abc = combine_crc64nvme([part_a, part_b, part_c], [size_a, size_b, size_c])

    # Combine (A+B) first, then C: combine(combine(A, B), C)
    combined_ab = combine_crc64nvme([part_a, part_b], [size_a, size_b])
    result_ab_c = combine_crc64nvme([combined_ab, part_c], [size_a + size_b, size_c])

    # Combine A with (B+C): combine(A, combine(B, C))
    combined_bc = combine_crc64nvme([part_b, part_c], [size_b, size_c])
    result_a_bc = combine_crc64nvme([part_a, combined_bc], [size_a, size_b + size_c])

    assert result_abc == result_ab_c
    assert result_abc == result_a_bc
