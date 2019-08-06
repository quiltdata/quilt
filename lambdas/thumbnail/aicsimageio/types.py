#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Collection of types used across multiple objects and functions.
"""

from io import BufferedIOBase
from pathlib import Path
from typing import Union, NamedTuple, Any

import numpy as np

# Imaging Data Types
SixDArray = np.ndarray  # In order STCZYX

# IO Types
PathLike = Union[str, Path]
BufferLike = Union[bytes, BufferedIOBase]
FileLike = Union[PathLike, BufferLike]
ImageLike = Union[FileLike, np.ndarray]


class LoadResults(NamedTuple):
    data: SixDArray
    dims: str
    metadata: Any
