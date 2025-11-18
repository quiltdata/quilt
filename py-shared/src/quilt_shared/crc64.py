"""Efficient CRC64-NVME checksum combination using GF(2) matrix multiplication.

This module provides O(log n) CRC64 extension using precomputed transformation matrices.
The naive bit-by-bit approach would take O(n*8) time, which is prohibitively slow for
multi-gigabyte parts (e.g., 58 minutes for a 4.7 GB file vs 4 milliseconds with this approach).
"""

from __future__ import annotations

import functools

# CRC64-NVME reflected polynomial
_CRC64_POLY = 0x9A6C9329AC4BC9B5

# CRC64 constants
_CRC64_BITS = 64
_CRC64_BYTES = 8
_BYTEORDER = "big"


def _build_single_byte_matrix() -> list[int]:
    """Build the 64×64 GF(2) matrix representing CRC update for 1 byte of zeros.

    Each entry i represents the result of processing 1 byte of zeros
    starting from a CRC state with only bit i set.

    Returns: List of 64 integers (each int is a row of the matrix)
    """
    matrix = []

    for bit_pos in range(_CRC64_BITS):
        # Start with CRC having only bit bit_pos set
        crc = 1 << bit_pos

        # Process 8 bits (1 byte) of zeros using reflected CRC algorithm
        for _ in range(_CRC64_BYTES):
            if crc & 1:  # Check LSB for reflected CRC
                crc = (crc >> 1) ^ _CRC64_POLY
            else:
                crc = crc >> 1

        matrix.append(crc)

    return matrix


def _matrix_multiply_gf2(matrix_a: list[int], matrix_b: list[int]) -> list[int]:
    """Multiply two 64×64 GF(2) matrices.

    Each matrix is represented as a list of 64 integers where each integer
    is a row (64 bits). In GF(2): addition is XOR, multiplication is AND.
    """
    result = []

    for i in range(_CRC64_BITS):
        row = 0
        for j in range(_CRC64_BITS):
            # Compute dot product of row i from matrix_a with column j from matrix_b
            col_bits = 0
            for k in range(_CRC64_BITS):
                if matrix_b[k] & (1 << j):  # If bit j is set in row k
                    col_bits ^= (matrix_a[i] >> k) & 1  # XOR with bit k from row i

            if col_bits:
                row |= 1 << j

        result.append(row)

    return result


@functools.cache
def _get_matrix_for_power(k: int) -> list[int]:
    """Get transformation matrix for extending CRC by 2^k bytes (lazy, cached).

    Matrix is computed on-demand using recursion: M^(2^k) = (M^(2^(k-1)))^2
    Results are cached, so each power is computed at most once.

    Args:
        k: Power of 2 (e.g., k=20 returns matrix for 2^20 bytes = 1 MiB)

    Returns:
        Transformation matrix as list of 64 integers
    """
    if k == 0:
        # Base case: matrix for 2^0 = 1 byte
        return _build_single_byte_matrix()

    # Recursive case: M^(2^k) = (M^(2^(k-1)))^2
    prev_matrix = _get_matrix_for_power(k - 1)
    return _matrix_multiply_gf2(prev_matrix, prev_matrix)


def _apply_matrix_gf2(matrix: list[int], crc: int) -> int:
    """Apply a 64×64 GF(2) matrix to a 64-bit CRC value."""
    result = 0
    for bit_pos in range(_CRC64_BITS):
        if crc & (1 << bit_pos):
            result ^= matrix[bit_pos]
    return result


def crc64_extend(crc: int, data_len: int) -> int:
    """Extend CRC for data_len zero bytes using lazy matrix computation.

    Matrices are computed on-demand and cached, supporting unbounded offsets.
    Time complexity: O(log(data_len)) with one-time O(log(data_len)) setup cost.

    Args:
        crc: Current CRC64 value (0 <= crc < 2^64)
        data_len: Number of zero bytes to extend by (>= 0)

    Returns:
        Extended CRC64 value

    Raises:
        ValueError: If crc or data_len are out of valid range
    """
    if data_len < 0:
        raise ValueError(f"data_len must be non-negative, got {data_len}")
    if not (0 <= crc < (1 << _CRC64_BITS)):
        raise ValueError(f"crc must be 64-bit unsigned (0 <= crc < 2^64), got {crc}")

    if data_len == 0:
        return crc

    result = crc

    # Decompose data_len into powers of 2 and apply transformations
    power = 0
    remaining = data_len

    while remaining > 0:
        if remaining & 1:
            # Apply transformation for 2^power bytes (computed lazily, cached)
            matrix = _get_matrix_for_power(power)
            result = _apply_matrix_gf2(matrix, result)

        remaining >>= 1
        power += 1

    return result


def combine_crc64nvme(part_crcs: list[bytes], part_sizes: list[int]) -> bytes:
    """Combine per-part CRC64NVME checksums into whole-file checksum.

    CRC64 is composable: CRC(A || B) can be computed from CRC(A), CRC(B), and len(B).

    Uses efficient GF(2) matrix multiplication with O(log n) time complexity per part.
    The CRC64-NVME reflected polynomial is 0x9a6c9329ac4bc9b5.

    Args:
        part_crcs: List of per-part CRC64 checksums (as bytes, big-endian)
        part_sizes: List of part sizes in bytes (must match length of part_crcs)

    Returns:
        Combined CRC64 checksum as 8 bytes (big-endian)

    Raises:
        ValueError: If part_crcs and part_sizes have different lengths
    """
    if len(part_crcs) != len(part_sizes):
        raise ValueError("part_crcs and part_sizes must have the same length")

    if len(part_crcs) == 0:
        return b"\x00" * _CRC64_BYTES

    # Convert first CRC from bytes to int (big-endian)
    combined = int.from_bytes(part_crcs[0], byteorder=_BYTEORDER)

    # Combine remaining CRCs using fast matrix-based extension
    for i in range(1, len(part_crcs)):
        # Extend combined CRC for the length of the next part
        combined = crc64_extend(combined, part_sizes[i])
        # XOR with the next part's CRC
        part_crc = int.from_bytes(part_crcs[i], byteorder=_BYTEORDER)
        combined ^= part_crc

    # Convert back to bytes (big-endian)
    return combined.to_bytes(_CRC64_BYTES, byteorder=_BYTEORDER)
