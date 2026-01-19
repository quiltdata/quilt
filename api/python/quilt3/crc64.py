from __future__ import annotations

import typing as T

import awscrt.checksums

# CRC64 constants
_CRC64_BYTES = 8
_BYTEORDER = "big"


def combine_crc64nvme(part_crcs: T.Sequence[bytes], part_sizes: T.Sequence[int]) -> bytes:
    """Combine per-part CRC64NVME checksums into whole-file checksum.

    CRC64 is composable: CRC(A || B) can be computed from CRC(A), CRC(B), and len(B).

    Args:
        part_crcs: Sequence of per-part CRC64 checksums (as bytes, big-endian)
        part_sizes: Sequence of part sizes in bytes (must match length of part_crcs)

    Returns:
        Combined CRC64 checksum as 8 bytes (big-endian)

    Raises:
        ValueError: If part_crcs and part_sizes have different lengths
    """
    if len(part_crcs) != len(part_sizes):
        raise ValueError("part_crcs and part_sizes must have the same length")

    if len(part_crcs) == 0:
        return b"\x00" * _CRC64_BYTES

    if len(part_crcs) == 1:
        return part_crcs[0]

    part_crcs_int = [int.from_bytes(crc, byteorder=_BYTEORDER) for crc in part_crcs]
    combined = part_crcs_int[0]

    for part_size, part_crc in zip(part_sizes[1:], part_crcs_int[1:]):
        combined = awscrt.checksums.combine_crc64nvme(combined, part_crc, part_size)

    # Convert back to bytes (big-endian)
    return combined.to_bytes(_CRC64_BYTES, byteorder=_BYTEORDER)
