import pytest

import t4_lambda_s3hash


@pytest.mark.parametrize("size", [-1, 5 * 2**40 + 1])
def test_get_part_size_raises(size):
    with pytest.raises(ValueError) as excinfo:
        t4_lambda_s3hash.get_part_size(size)

    assert str(excinfo.value) == "size must be non-negative and less than 5 TiB"


@pytest.mark.parametrize(
    "part_size, size",
    [
        (None, 0),
        (None, 8 * 2**20 - 1),
        (8 * 2**20, 8 * 2**20),
        (8 * 2**20, 10_000 * 8 * 2**20),
        (8 * 2**21, 10_000 * 8 * 2**20 + 1),
        (8 * 2**21, 10_000 * 8 * 2**21),
        (8 * 2**22, 10_000 * 8 * 2**21 + 1),
        (8 * 2**22, 10_000 * 8 * 2**22),
        (8 * 2**23, 10_000 * 8 * 2**22 + 1),
        (8 * 2**23, 10_000 * 8 * 2**23),
        (8 * 2**24, 10_000 * 8 * 2**23 + 1),
        (8 * 2**24, 10_000 * 8 * 2**24),
        (8 * 2**25, 10_000 * 8 * 2**24 + 1),
        (8 * 2**25, 10_000 * 8 * 2**25),
        (8 * 2**26, 10_000 * 8 * 2**25 + 1),
        (8 * 2**26, 10_000 * 8 * 2**26),
        (8 * 2**27, 10_000 * 8 * 2**26 + 1),
        (8 * 2**27, 5 * 2**40),
    ],
)
def test_get_part_size(size, part_size):
    assert t4_lambda_s3hash.get_part_size(size) == part_size
