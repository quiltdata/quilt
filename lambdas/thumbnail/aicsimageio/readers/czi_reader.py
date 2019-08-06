import io
import logging
import warnings
import xml.etree
from typing import Optional

import numpy as np

from aicsimageio import types

from ..buffer_reader import BufferReader
from ..exceptions import MultiSceneCziException, UnsupportedFileFormatError
from .reader import Reader

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from ..vendor import czifile

log = logging.getLogger(__name__)


class CziReader(Reader):
    """
    CziReader is intended for reading single scene Czi files. It is meant to handle the specifics of using the backend
    library to create a unified interface. This enables higher level functions to duck type the File Readers.
    """
    ZEISS_2BYTE = b'ZI'             # First two characters of a czi file according to Zeiss docs
    ZEISS_10BYTE = b'ZISRAWFILE'    # First 10 characters of a well formatted czi file.

    def __init__(self, file: types.FileLike, max_workers: Optional[int] = None, **kwargs):
        """

        Parameters
        ----------
        file : a file like object ("Filename.czi", Path("/path/Filename.czi") or an open stream to the data
        max_workers : (Optional) the number of cores the backend library is allowed to use to load the data in the file.
        """
        super().__init__(file, **kwargs)
        try:
            self.czi = czifile.CziFile(self._bytes)
        except Exception:
            log.error("czifile could not parse this input")
            raise UnsupportedFileFormatError("exception from with CziFile backend library.")

        if self._is_multiscene():
            raise MultiSceneCziException(
                "File is Multiscene. The backend library CziFile can only read single scene images."
            )

        self._max_workers = max_workers

    @staticmethod
    def _is_this_type(buffer: io.BufferedIOBase) -> bool:
        with BufferReader(buffer) as buffer_reader:
            if buffer_reader.endianness != CziReader.ZEISS_2BYTE:
                return False
            header = buffer_reader.endianness + buffer_reader.read_bytes(8)
            return header == CziReader.ZEISS_10BYTE

    @property
    def data(self) -> np.ndarray:
        """
        Returns
        -------
        the data from the czi file with the native order (i.e. "TZCYX")
        """
        if self._data is None:
            # load the data
            self._data = self.czi.asarray(max_workers=self._max_workers)
        return self._data

    @property
    def dims(self) -> str:
        """
        Returns
        -------
        The native shape of the image.
        """
        return self.czi.axes

    @property
    def metadata(self) -> xml.etree.ElementTree:
        """
        Lazy load the metadata from the CZI file
        Returns
        -------
        The xml Element Tree of the metadata
        """
        if self._metadata is None:
            # load the metadata
            self._metadata = self.czi.metadata
        return self._metadata

    def close(self):
        """
        Close the czi file handle and perform any upstream cleanup
        Returns
        -------
        None
        """
        self.czi.close()
        super().close()

    def dtype(self) -> np.dtype:
        """
        Returns
        -------
        the data type of the ndarray being returned (uint16, uint8, etc)
        """
        return self.czi.dtype

    def size_s(self):
        """
        Returns
        -------
        The number of scenes in the data
        """
        return self._size_of_dimension('S')

    def size_z(self):
        """
        Returns
        -------
        The number of Z slices in the stack
        """
        return self._size_of_dimension('Z')

    def size_c(self):
        """
        Returns
        -------
        The number of Channels present in the data
        """
        return self._size_of_dimension('C')

    def size_t(self):
        """
        Returns
        -------
        The number of time steps in the data
        """
        return self._size_of_dimension('T')

    def size_x(self):
        """
        Returns
        -------
        The number of pixels in the images X axis
        """
        return self._size_of_dimension('X')

    def size_y(self):
        """
        Returns
        -------
        The number of pixels in the images Y axis
        """
        return self._size_of_dimension('Y')

    def _size_of_dimension(self, dimension: str) -> int:
        """
        Parameters
        ----------
        dimension : str (a single character)

        Raises
        ------
        If a string of length greater or smaller than 1 is passed in raise a TypeError

        Returns
        -------
        The size of the dimension in the data, if the dimension is not found in the "BTCZYX" type string
        then the default dimension size of 1 is returned.
        """

        index = self._lookup_dimension_index(dimension)
        if index == -1:
            return 1
        return self.czi.shape[index]

    def _lookup_dimension_index(self, dimension: str) -> int:
        """
        Use the axes metadata in the czi file to find the dimension index, additionally this
        function should be used for determining if a Dimension is present in the native data.
        Parameters
        ----------
        dimension : str (a single character)
            sensible values are any one of ('V', 'H', 'M', 'B', 'I', 'S', 'T', 'R', 'Z', 'C', 'Y', 'X')
            most likely values are one of ('S', 'T', 'C', 'Z', 'Y', 'X')

        Raises
        ------
        If a string of length greater or smaller than 1 is passed in raise a TypeError

        Returns
        -------
        the integer position of the channel or -1 if the character is not present in the file description
        """
        if len(dimension) != 1:
            raise TypeError(f"channel lookup requested with channel {dimension}")
        return self.czi.axes.find(dimension)

    def _is_multiscene(self):
        """
        Check if the metadata the czi is multiscene

        Returns
        -------
        True if multi-scene, False if single-scene
        """
        index = self._lookup_dimension_index('S')
        if index < 0:
            return False
        img_shape = self.czi.filtered_subblock_directory[0].shape
        return img_shape[index] != 1
