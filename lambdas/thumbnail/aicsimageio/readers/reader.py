#!/usr/bin/env python
# -*- coding: utf-8 -*-

import io
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import numpy as np

from .. import constants, types


class Reader(ABC):

    _bytes = None

    _data = None
    _dims = None
    _metadata = None

    def __init__(self, file: types.FileLike, **kwargs):
        # Convert to BytesIO
        self._bytes = self.convert_to_buffer(file)

    @staticmethod
    def guess_dim_order(shape: tuple) -> str:
        return constants.DEFAULT_DIMENSION_ORDER[len(constants.DEFAULT_DIMENSION_ORDER) - len(shape):]

    @staticmethod
    def convert_to_buffer(file: types.FileLike) -> io.BufferedIOBase:
        # Check path
        if isinstance(file, (str, Path)):
            # This will both fully expand and enforce that the filepath exists
            f = Path(file).expanduser().resolve(strict=True)

            # This will check if the above enforced filepath is a directory
            if f.is_dir():
                raise IsADirectoryError(f)

            return open(f, "rb")

        # Convert bytes
        elif isinstance(file, bytes):
            return io.BytesIO(file)

        # Set bytes
        elif isinstance(file, io.BytesIO):
            return file

        # Special case for ndarray because already in memory
        elif isinstance(file, np.ndarray):
            return file

        # Raise
        else:
            raise TypeError(
                f"Reader only accepts types: [str, pathlib.Path, bytes, io.BytesIO], received: {type(file)}"
            )

    @classmethod
    def is_this_type(cls, file: types.FileLike) -> bool:
        buffer = cls.convert_to_buffer(file)
        return cls._is_this_type(buffer)

    @staticmethod
    @abstractmethod
    def _is_this_type(buffer: io.BufferedIOBase) -> bool:
        pass

    @property
    @abstractmethod
    def data(self) -> np.ndarray:
        pass

    @property
    @abstractmethod
    def dims(self) -> str:
        pass

    @property
    @abstractmethod
    def metadata(self) -> Any:
        pass

    def load(self) -> types.LoadResults:
        return types.LoadResults(self.data, self.dims, self.metadata)

    def close(self) -> None:
        self._bytes.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
