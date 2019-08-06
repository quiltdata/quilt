#!/usr/bin/env python
# -*- coding: utf-8 -*-

import numpy as np

from .. import exceptions
from .reader import Reader


class NdArrayReader(Reader):
    """
    NdArrayReader(np.ones((1,2,3)))

    A catch all for numpy ndarray reading.

    Parameters
    ----------
    arr: numpy.ndarray
        An in memory numpy ndarray.

    Notes
    -----
    Because this is simply a wrapper around numpy ndarray, no metadata is returned. However, dimension order is
    returned with dimensions assumed in order but with extra dimensions removed depending on image shape.
    """

    def __init__(self, arr: np.ndarray):
        self._data = arr
        self._dims = self.guess_dim_order(self.data.shape)

    @property
    def data(self) -> np.ndarray:
        return self._data

    @property
    def dims(self) -> str:
        return self._dims

    @dims.setter
    def dims(self, dims: str):
        # Check amount of provided dims against data shape
        if len(dims) != len(self.data.shape):
            raise exceptions.InvalidDimensionOrderingError(
                f"Provided too many dimensions for the associated array. "
                f"Received {len(dims)} dimensions [dims: {dims}] "
                f"for image with {len(self.data.shape)} dimensions [shape: {self.data.shape}]."
            )

        # Set the dims
        self._dims = dims

    @property
    def metadata(self) -> None:
        return None

    @staticmethod
    def _is_this_type(arr: np.ndarray) -> bool:
        return isinstance(arr, np.ndarray)

    def close(self) -> None:
        pass
