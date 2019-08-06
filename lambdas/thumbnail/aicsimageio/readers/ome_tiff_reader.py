import logging
import io
import re

import numpy as np
import tifffile

from ..vendor import omexml
from .reader import Reader
from .tiff_reader import TiffReader
from .. import types


log = logging.getLogger(__name__)


class OmeTiffReader(Reader):
    """Opening and processing the contents of an OME Tiff file
    """

    def __init__(self, file: types.FileLike, **kwargs):
        super().__init__(file, **kwargs)
        try:
            self.tiff = tifffile.TiffFile(self._bytes)
        except Exception:
            log.error("tiffile could not parse this input")
            raise

    def _lazy_init_metadata(self) -> omexml.OMEXML:
        if self._metadata is None and self.tiff.is_ome:
            description = self.tiff.pages[0].description.strip()
            if not (description.startswith("<?xml version=") and description.endswith("</OME>")):
                raise ValueError(f'Description does not conform to OME specification: {description[:100]}')
            self._metadata = omexml.OMEXML(description)
        return self._metadata

    @staticmethod
    def _is_this_type(buffer: io.BufferedIOBase) -> bool:
        is_tif = TiffReader._is_this_type(buffer)
        if is_tif:
            buf = TiffReader.get_image_description(buffer)
            if buf is None:
                return False
            if buf[0:5] != b"<?xml":
                return False
            match = re.search(
                b'<(\\w*)(:?)OME [^>]*xmlns\\2\\1="http://www.openmicroscopy.org/Schemas/[Oo][Mm][Ee]/',
                buf
            )
            if match is None:
                return False
            return True
        return False

    @property
    def data(self) -> np.ndarray:
        if self._data is None:
            # load the data
            self._data = self.tiff.asarray()
        return self._data

    @property
    def dims(self) -> str:
        self._lazy_init_metadata()
        dimension_order = self._metadata.image().Pixels.DimensionOrder
        # reverse the string
        dimension_order = dimension_order[::-1]
        # see if t,z,or c is squeezed out.
        # this is a tifffile implementation detail -- see squeeze_axes in tifffile.
        if self.size_t() < 2:
            dimension_order = dimension_order.replace("T", "")
        if self.size_c() < 2:
            dimension_order = dimension_order.replace("Z", "")
        if self.size_z() < 2:
            dimension_order = dimension_order.replace("C", "")
        return dimension_order

    @property
    def metadata(self) -> omexml.OMEXML:
        return self._lazy_init_metadata()

    def load_slice(self, slice_index=0):
        data = self.tiff.asarray(key=slice_index)
        return data

    def size_z(self):
        return self.metadata.image().Pixels.SizeZ

    def size_c(self):
        return self.metadata.image().Pixels.SizeC

    def size_t(self):
        return self.metadata.image().Pixels.SizeT

    def size_x(self):
        return self.metadata.image().Pixels.SizeX

    def size_y(self):
        return self.metadata.image().Pixels.SizeY

    def dtype(self):
        return self.tiff.pages[0].dtype

    def is_ome(self):
        return OmeTiffReader._is_this_type(self._bytes)
