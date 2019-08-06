import io
from typing import Optional

import numpy as np
import tifffile

from .. import types
from ..buffer_reader import BufferReader
from . import reader


class TiffReader(reader.Reader):
    """This class is used to open and process the contents of a generic tiff file.

    The load function will get a 3D ZYX array from a tiff file.
    """

    @staticmethod
    def _is_this_type(buffer: io.BufferedIOBase) -> bool:
        with BufferReader(buffer) as buffer_reader:
            # Per the TIFF-6 spec (https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf),
            # 'II' is little-endian (Intel format) and 'MM' is big-endian (Motorola format)
            if buffer_reader.endianness not in [buffer_reader.INTEL_ENDIAN, buffer_reader.MOTOROLA_ENDIAN]:
                return False
            magic = buffer_reader.read_uint16()

            # Per TIFF-6, magic is 42.
            if magic == 42:
                ifd_offset = buffer_reader.read_uint32()
                if ifd_offset == 0:
                    return False

            # Per BigTIFF (https://www.awaresystems.be/imaging/tiff/bigtiff.html), magic is 43.
            if magic == 43:
                # Alex magic here...
                if buffer_reader.read_uint16() != 8:
                    return False
                if buffer_reader.read_uint16() != 0:
                    return False
                ifd_offset = buffer_reader.read_uint64()
                if ifd_offset == 0:
                    return False
            return True

    @staticmethod
    def get_image_description(buffer: io.BufferedIOBase) -> Optional[bytearray]:
        """Retrieve the image description as one large string."""
        description_length = 0
        description_offset = 0

        with BufferReader(buffer) as buffer_reader:
            # Per the TIFF-6 spec (https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf),
            # 'II' is little-endian (Intel format) and 'MM' is big-endian (Motorola format)
            if buffer_reader.endianness not in [buffer_reader.INTEL_ENDIAN, buffer_reader.MOTOROLA_ENDIAN]:
                return None
            magic = buffer_reader.read_uint16()

            # Per TIFF-6, magic is 42.
            if magic == 42:
                found = False
                while not found:
                    ifd_offset = buffer_reader.read_uint32()
                    if ifd_offset == 0:
                        return None
                    buffer_reader.buffer.seek(ifd_offset, 0)
                    entries = buffer_reader.read_uint16()
                    for n in range(0, entries):
                        tag = buffer_reader.read_uint16()
                        type = buffer_reader.read_uint16()
                        count = buffer_reader.read_uint32()
                        offset = buffer_reader.read_uint32()
                        if tag == 270:
                            description_length = count - 1  # drop the NUL from the end
                            description_offset = offset
                            found = True
                            break

            # Per BigTIFF (https://www.awaresystems.be/imaging/tiff/bigtiff.html), magic is 43.
            if magic == 43:
                # Alex magic here...
                if buffer_reader.read_uint16() != 8:
                    return None
                if buffer_reader.read_uint16() != 0:
                    return None
                found = False
                while not found:
                    ifd_offset = buffer_reader.read_uint64()
                    if ifd_offset == 0:
                        return None
                    buffer_reader.buffer.seek(ifd_offset, 0)
                    entries = buffer_reader.read_uint64()
                    for n in range(0, entries):
                        tag = buffer_reader.read_uint16()
                        type = buffer_reader.read_uint16()  # noqa: F841
                        count = buffer_reader.read_uint64()
                        offset = buffer_reader.read_uint64()
                        if tag == 270:
                            description_length = count - 1  # drop the NUL from the end
                            description_offset = offset
                            found = True
                            break

            if description_offset == 0:
                # Nothing was found
                return bytearray("")
            else:
                buffer_reader.buffer.seek(description_offset, 0)
                return bytearray(buffer_reader.buffer.read(description_length))

    def __init__(self, file: types.FileLike, **kwargs):
        super().__init__(file, **kwargs)
        self.tiff = tifffile.TiffFile(self._bytes)

    def close(self):
        self.tiff.close()
        super().close()

    def dtype(self):
        return self.tiff.pages[0].dtype

    @property
    def data(self) -> np.ndarray:
        if self._data is None:
            self._data = self.tiff.asarray()
        return self._data

    @property
    def dims(self) -> str:
        if self._dims is None:
            self._dims = self.guess_dim_order(self.data.shape)

        return self._dims

    @dims.setter
    def dims(self, value: str) -> None:
        self._dims = value

    @property
    def metadata(self) -> str:
        if self._metadata is None:
            description = self.get_image_description(self._bytes)
            if description is None:
                self._metadata = ''
            else:
                self._metadata = description.decode()
        return self._metadata
