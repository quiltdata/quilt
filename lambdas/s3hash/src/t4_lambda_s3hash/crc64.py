"""Efficient CRC64-NVME checksum combination using GF(2) matrix multiplication.

This module provides O(log n) CRC64 extension using precomputed transformation matrices.
The naive bit-by-bit approach would take O(n*8) time, which is prohibitively slow for
multi-gigabyte parts (e.g., 58 minutes for a 4.7 GB file vs 4 milliseconds with this approach).
"""

from __future__ import annotations

import logging
import typing as T


logger = logging.getLogger(__name__)

# CRC64-NVME reflected polynomial
_CRC64_POLY = 0x9A6C9329AC4BC9B5

# Global power table cache (built once on first use)
_CRC64_POWER_TABLE: T.Optional[T.List[T.List[int]]] = None


def _build_single_byte_matrix() -> T.List[int]:
    """Build the 64×64 GF(2) matrix representing CRC update for 1 byte of zeros.

    Each entry i represents the result of processing 1 byte of zeros
    starting from a CRC state with only bit i set.

    Returns: List of 64 integers (each int is a row of the matrix)
    """
    matrix = []

    for bit_pos in range(64):
        # Start with CRC having only bit bit_pos set
        crc = 1 << bit_pos

        # Process 8 bits (1 byte) of zeros using reflected CRC algorithm
        for _ in range(8):
            if crc & 1:  # Check LSB for reflected CRC
                crc = (crc >> 1) ^ _CRC64_POLY
            else:
                crc = crc >> 1

        matrix.append(crc)

    return matrix


def _matrix_multiply_gf2(matrix_a: T.List[int], matrix_b: T.List[int]) -> T.List[int]:
    """Multiply two 64×64 GF(2) matrices.

    Each matrix is represented as a list of 64 integers where each integer
    is a row (64 bits). In GF(2): addition is XOR, multiplication is AND.
    """
    result = []

    for i in range(64):
        row = 0
        for j in range(64):
            # Compute dot product of row i from matrix_a with column j from matrix_b
            col_bits = 0
            for k in range(64):
                if matrix_b[k] & (1 << j):  # If bit j is set in row k
                    col_bits ^= (matrix_a[i] >> k) & 1  # XOR with bit k from row i

            if col_bits:
                row |= 1 << j

        result.append(row)

    return result


def _build_power_table() -> T.List[T.List[int]]:
    """Build table of matrices for extending by 2^k bytes (k = 0 to 40).

    power_table[k] represents the transformation matrix for extending CRC
    by 2^k bytes. Returns list of matrices where each matrix is a list of 64 ints.

    This is a one-time setup cost (~1 second) that enables O(log n) CRC extension.
    """
    # Start with the matrix for 1 byte
    single_byte_matrix = _build_single_byte_matrix()
    power_table = [single_byte_matrix]

    # Each subsequent entry is the previous one squared: M^(2^k) = (M^(2^(k-1)))^2
    for k in range(1, 41):  # Up to 2^40 bytes = 1 TB
        prev_matrix = power_table[k - 1]
        squared_matrix = _matrix_multiply_gf2(prev_matrix, prev_matrix)
        power_table.append(squared_matrix)

    return power_table


def _get_power_table() -> T.List[T.List[int]]:
    """Get or build the precomputed CRC64 power table."""
    global _CRC64_POWER_TABLE
    if _CRC64_POWER_TABLE is None:
        logger.info("Building CRC64 power table (one-time setup)...")
        _CRC64_POWER_TABLE = _build_power_table()
        logger.info("CRC64 power table built successfully")
    return _CRC64_POWER_TABLE


def _apply_matrix_gf2(matrix: T.List[int], crc: int) -> int:
    """Apply a 64×64 GF(2) matrix to a 64-bit CRC value."""
    result = 0
    for bit_pos in range(64):
        if crc & (1 << bit_pos):
            result ^= matrix[bit_pos]
    return result


def crc64_extend(crc: int, data_len: int) -> int:
    """Extend CRC for data_len zero bytes using matrix power table.

    Time complexity: O(log(data_len)) instead of O(data_len * 8)

    Args:
        crc: Current CRC64 value
        data_len: Number of zero bytes to extend by

    Returns:
        Extended CRC64 value
    """
    if data_len == 0:
        return crc

    power_table = _get_power_table()
    result = crc

    # Decompose data_len into powers of 2 and apply transformations
    power = 0
    remaining = data_len

    while remaining > 0 and power < len(power_table):
        if remaining & 1:
            # Apply transformation for 2^power bytes
            result = _apply_matrix_gf2(power_table[power], result)

        remaining >>= 1
        power += 1

    return result


def combine_crc64nvme(part_crcs: T.List[bytes], part_sizes: T.List[int]) -> bytes:
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
        return b"\x00" * 8

    # Convert first CRC from bytes to int (big-endian)
    combined = int.from_bytes(part_crcs[0], byteorder='big')

    # Combine remaining CRCs using fast matrix-based extension
    for i in range(1, len(part_crcs)):
        # Extend combined CRC for the length of the next part
        combined = crc64_extend(combined, part_sizes[i])
        # XOR with the next part's CRC
        part_crc = int.from_bytes(part_crcs[i], byteorder='big')
        combined ^= part_crc

    # Convert back to bytes (big-endian)
    return combined.to_bytes(8, byteorder='big')
