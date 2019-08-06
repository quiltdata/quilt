# -*- coding: utf-8 -*-
# czifile.py

# Copyright (c) 2013-2017, Christoph Gohlke
# Copyright (c) 2013-2017, The Regents of the University of California
# Produced at the Laboratory for Fluorescence Dynamics.
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
# * Redistributions of source code must retain the above copyright
#   notice, this list of conditions and the following disclaimer.
# * Redistributions in binary form must reproduce the above copyright
#   notice, this list of conditions and the following disclaimer in the
#   documentation and/or other materials provided with the distribution.
# * Neither the name of the copyright holders nor the names of any
#   contributors may be used to endorse or promote products derived
#   from this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
# LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
# CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
# INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
# CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
# ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
# POSSIBILITY OF SUCH DAMAGE.

"""Read image and metadata from Carl Zeiss(r) ZISRAW (CZI) files.

CZI is the native image file format of the ZEN(r) software by Carl Zeiss
Microscopy GmbH. It stores multidimensional images and metadata from
microscopy experiments.

:Author:
  `Christoph Gohlke <http://www.lfd.uci.edu/~gohlke/>`_

:Organization:
  Laboratory for Fluorescence Dynamics, University of California, Irvine

:Version: 2017.09.12

Requirements
------------
* `CPython 3.6 64-bit <http://www.python.org>`_
* `Numpy 1.13 <http://www.numpy.org>`_
* `Scipy 0.19 <http://www.scipy.org>`_
* `Tifffile.py 2017.09.12 <http://www.lfd.uci.edu/~gohlke/>`_
* `Czifle.pyx 2017.07.20 <http://www.lfd.uci.edu/~gohlke/>`_
  (for decoding JpegXrFile and JpgFile images)

Revisions
---------
2017.09.12
    Require tifffile.py 2017.09.12
2017.07.21
    Use multi-threading in CziFile.asarray to decode and copy segment data.
    Always convert BGR to RGB. Remove bgr2rgb options.
    Decode JpegXR directly from byte arrays.
2017.07.13
    Add function to convert CZI file to memory-mappable TIFF file.
2017.07.11
    Add 'out' parameter to CziFile.asarray.
    Remove memmap option from CziFile.asarray (backwards incompatible).
    Change spline interpolation order to 0 (backwards incompatible).
    Make axes return a string.
    Require tifffile 2017.07.11.
2015.08.17
    Require tifffile 2015.08.17.
2014.10.10
    Read data into a memory mapped array (optional).
2013.12.04
    Decode JpegXrFile and JpgFile via _czifle extension module.
    Attempt to reconstruct tiled mosaic images.
2013.11.20
    Initial release.

Notes
-----
The API is not stable yet and might change between revisions.

The file format design specification [1] is confidential and the licence
agreement does not permit to write data into CZI files.

Only a subset of the 2012 specification is implemented in the initial release.
Specifically, multifile images are not yet supported.

Tested on Windows with a few example files only.

References
----------
(1) ZISRAW (CZI) File Format Design specification Release Version 1.2.2.
    CZI 07-2016/CZI-DOC ZEN 2.3/DS_ZISRAW-FileFormat.pdf (confidential).
    Documentation can be requested at
    <http://microscopy.zeiss.com/microscopy/en_us/downloads/zen.html>
(2) CZI The File Format for the Microscope | ZEISS International
    <http://microscopy.zeiss.com/microscopy/en_us/products/microscope-software/
    zen-2012/czi.html>

Examples
--------
>>> with CziFile('test.czi') as czi:
...     image = czi.asarray()
>>> image.shape
(3, 3, 3, 250, 200, 3)
>>> image[0, 0, 0, 0, 0]
array([10, 10, 10], dtype=uint8)

"""

from __future__ import division, print_function

import os
import sys
import re
import uuid
import time
import struct
import warnings
import multiprocessing

from concurrent.futures import ThreadPoolExecutor

try:
    from lxml import etree
except ImportError:
    from xml.etree import cElementTree as etree

import numpy
from scipy.ndimage.interpolation import zoom

from tifffile import (FileHandle, memmap, decode_lzw, lazyattr, repeat_nd,
                      product, stripnull, format_size, squeeze_axes,
                      create_output)

try:
    if __package__:
        from aicsimageio import _czifile
    else:
        import _czifile
except ImportError:
    warnings.warn(
        "ImportError: No module named '_czifile'. "
        "Decoding of JXR and JPEG encoded images will not be available. "
        "Czifile.pyx can be obtained at http://www.lfd.uci.edu/~gohlke/")
    _czifile = None

__version__ = '2017.09.12'
__docformat__ = 'restructuredtext en'
__all__ = 'imread', 'CziFile'


def imread(filename, *args, **kwargs):
    """Return image data from CZI file as numpy array.

    'args' and 'kwargs' are arguments to the CziFile.asarray function.

    Examples
    --------
    >>> image = imread('test.czi')
    >>> image.shape
    (3, 3, 3, 250, 200, 3)
    >>> image.dtype
    dtype('uint8')

    """
    with CziFile(filename) as czi:
        result = czi.asarray(*args, **kwargs)
    return result


class CziFile(object):
    """Carl Zeiss Image (CZI) file.

    Attributes
    ----------
    header : FileHeaderSegment
        Global file metadata such as file version and GUID.
    metadata : etree.ElementTree.Element
        Global image metadata in UTF-8 encoded XML format.

    All attributes are read-only.

    """
    def __init__(self, arg, multifile=True, filesize=None, detectmosaic=True):
        """Open CZI file and read header.

        Raise ValueError if file is not a ZISRAW file.

        Parameters
        ----------
        multifile : bool
            If True (default), the master file of a multifile CZI file
            will be opened if applicable.
        filesize : int
            Size of file if arg is a file handle pointing to an
            embedded CZI file.
        detectmosaic : bool
            If True (default), mosaic images will be reconstructed from
            SubBlocks with a tile index.

        Notes
        -----
        CziFile instances created from file name must be closed using the
        'close' method, which is automatically called when using the
        'with' statement.

        """
        self._fh = FileHandle(arg, size=filesize)
        try:
            if self._fh.read(10) != b'ZISRAWFILE':
                raise ValueError("not a CZI file")
            self.header = Segment(self._fh, 0).data()
        except Exception:
            self._fh.close()
            raise

        if multifile and self.header.file_part and isinstance(arg, basestring):
            # open master file instead
            self._fh.close()
            name, _ = match_filename(arg)
            self._fh = FileHandle(name)
            self.header = Segment(self._fh, 0).data()
            assert(self.header.primary_file_guid == self.header.file_guid)
            assert(self.header.file_part == 0)

        if self.header.update_pending:
            warnings.warn("file is pending update")
        self._filter_mosaic = detectmosaic

    def segments(self, kind=None):
        """Return iterator over Segment data of specified kind.

        Parameters
        ----------
        kind : bytestring or sequence thereof
            Segment id(s) as listed in SEGMENT_ID.
            If None (default), all segments are returned.

        """
        fpos = 0
        while True:
            self._fh.seek(fpos)
            try:
                segment = Segment(self._fh)
            except SegmentNotFoundError:
                break
            if (kind is None) or (segment.sid in kind):
                yield segment.data()
            fpos = segment.data_offset + segment.allocated_size

    @lazyattr
    def metadata(self):
        """Return data from MetadataSegment as xml.ElementTree root Element.

        Return None if no Metadata segment is found.

        """
        if self.header.metadata_position:
            segment = Segment(self._fh, self.header.metadata_position)
            if segment.sid == MetadataSegment.SID:
                data = segment.data().data()
                return etree.fromstring(data.encode('utf-8'))
        warnings.warn("Metadata segment not found")
        try:
            metadata = next(self.segments(MetadataSegment.SID))
            return etree.fromstring(metadata.data().encode('utf-8'))
        except StopIteration:
            pass

    @lazyattr
    def subblock_directory(self):
        """Return list of all DirectoryEntryDV in file.

        Use SubBlockDirectorySegment if exists, else find SubBlockSegments.

        """
        if self.header.directory_position:
            segment = Segment(self._fh, self.header.directory_position)
            if segment.sid == SubBlockDirectorySegment.SID:
                return segment.data().entries
        warnings.warn("SubBlockDirectory segment not found")
        return list(segment.directory_entry for segment in
                    self.segments(SubBlockSegment.SID))

    @lazyattr
    def attachment_directory(self):
        """Return list of all AttachmentEntryA1 in file.

        Use AttachmentDirectorySegment if exists, else find AttachmentSegments.

        """
        if self.header.attachment_directory_position:
            segment = Segment(self._fh,
                              self.header.attachment_directory_position)
            if segment.sid == AttachmentDirectorySegment.SID:
                return segment.data().entries
        warnings.warn("AttachmentDirectory segment not found")
        return list(segment.attachment_entry for segment in
                    self.segments(AttachmentSegment.SID))

    def subblocks(self):
        """Return iterator over all SubBlock segments in file."""
        for entry in self.subblock_directory:
            yield entry.data_segment()

    def attachments(self):
        """Return iterator over all Attachment segments in file."""
        for entry in self.attachment_directory:
            yield entry.data_segment()

    def save_attachments(self, directory=None):
        """Save all attachments to files."""
        if directory is None:
            directory = self._fh.path + '.attachments'
        if not os.path.exists(directory):
            os.makedirs(directory)
        for attachment in self.attachments():
            attachment.save(directory=directory)

    @lazyattr
    def filtered_subblock_directory(self):
        """Return sorted list of DirectoryEntryDV if mosaic, else all."""
        if not self._filter_mosaic:
            return self.subblock_directory
        filtered = [directory_entry
                    for directory_entry in self.subblock_directory
                    if directory_entry.mosaic_index is not None]
        if not filtered:
            return self.subblock_directory
        return list(sorted(filtered, key=lambda x: x.mosaic_index))

    @lazyattr
    def shape(self):
        """Return shape of image data in file."""
        shape = [[dim.start + dim.size
                  for dim in directory_entry.dimension_entries
                  if dim.dimension != b'M']
                 for directory_entry in self.filtered_subblock_directory]
        shape = numpy.max(shape, axis=0)
        shape = tuple(int(i-j) for i, j in zip(shape, self.start[:-1]))
        dtype = self.filtered_subblock_directory[0].dtype
        sampleshape = numpy.dtype(dtype).shape
        shape = shape + (sampleshape if sampleshape else (1,))
        return shape

    @lazyattr
    def start(self):
        """Return minimum start indices per dimension of sub images in file."""
        start = [[dim.start
                  for dim in directory_entry.dimension_entries
                  if dim.dimension != b'M']
                 for directory_entry in self.filtered_subblock_directory]
        start = tuple(numpy.min(start, axis=0)) + (0,)
        return start

    @lazyattr
    def axes(self):
        """Return axes of image data in file."""
        return self.filtered_subblock_directory[0].axes

    @lazyattr
    def dtype(self):
        """Return numpy dtype of image data in file."""
        # subblock data can be of different pixel type
        dtype = numpy.dtype(self.filtered_subblock_directory[0].dtype[-2:])
        for directory_entry in self.filtered_subblock_directory:
            dtype = numpy.promote_types(dtype, directory_entry.dtype[-2:])
        return dtype

    def asarray(self, resize=True, order=0, out=None, max_workers=None):
        """Return image data from file(s) as numpy array.

        Parameters
        ----------
        resize : bool
            If True (default), resize sub/supersampled subblock data.
        order : int
            The order of spline interpolation used to resize sub/supersampled
            subblock data. Default is 0 (nearest neighbor).
        out : numpy.ndarray, str, or file-like object; optional
            Buffer where image data will be saved.
            If numpy.ndarray, a writable array of compatible dtype and shape.
            If str or open file, the file name or file object used to
            create a memory-map to an array stored in a binary file on disk.
        max_workers : int
            Maximum number of threads to read and decode subblock data.
            By default up to half the CPU cores are used.

        """
        out = create_output(out, self.shape, self.dtype)

        if max_workers is None:
            max_workers = multiprocessing.cpu_count() // 2

        def func(directory_entry, resize=resize, order=order,
                 start=self.start, out=out):
            """Read, decode, and copy subblock data."""
            subblock = directory_entry.data_segment()
            tile = subblock.data(resize=resize, order=order)
            index = [slice(i-j, i-j+k) for i, j, k in
                     zip(directory_entry.start, start, tile.shape)]
            try:
                out[index] = tile
            except ValueError as e:
                warnings.warn(str(e))

        if max_workers > 1:
            self._fh.lock = True
            with ThreadPoolExecutor(max_workers) as executor:
                executor.map(func, self.filtered_subblock_directory)
            self._fh.lock = None
        else:
            list(map(func, self.filtered_subblock_directory))

        if hasattr(out, 'flush'):
            out.flush()
        return out

    def close(self):
        self._fh.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def __str__(self):
        return '\n '.join((
            self._fh.name.capitalize(),
            "(Carl Zeiss Image File)",
            str(self.header),
            "MetadataSegment",
            str(self.axes),
            str(self.shape),
            str(self.dtype),
            str(etree.tostring(self.metadata))))


class Segment(object):
    """ZISRAW Segment."""

    __slots__ = 'sid', 'allocated_size', 'used_size', 'data_offset', '_fh'

    def __init__(self, fh, fpos=None):
        """Read segment header from file."""
        if fpos is not None:
            fh.seek(fpos)
        try:
            (self.sid,
             self.allocated_size,
             self.used_size
             ) = struct.unpack('<16sqq', fh.read(32))
        except struct.error:
            raise SegmentNotFoundError("can not read ZISRAW segment")
        self.sid = stripnull(self.sid)
        if self.sid not in SEGMENT_ID:
            if not self.sid.startswith(b'ZISRAW'):
                raise SegmentNotFoundError("not a ZISRAW segment")
            warnings.warn("unknown segment type %s" % self.sid)
        self.data_offset = fh.tell()
        self._fh = fh

    def data(self):
        """Read segment data from file and return as *Segment instance."""
        self._fh.seek(self.data_offset)
        return SEGMENT_ID.get(self.sid, UnknownSegment)(self._fh)

    def __str__(self):
        return "Segment %s %i of %i" % (
            self.sid, self.used_size, self.allocated_size)


class SegmentNotFoundError(Exception):
    """Exception to indicate that file position does not contain Segment."""
    pass


class FileHeaderSegment(object):
    """ZISRAWFILE file header segment data.

    Contains global file metadata such as file version and GUID.

    """
    __slots__ = ('version', 'primary_file_guid', 'file_guid',
                 'file_part', 'directory_position', 'metadata_position',
                 'update_pending', 'attachment_directory_position')

    SID = b'ZISRAWFILE'

    def __init__(self, fh):
        (major,
         minor,
         reserved1,
         reserved2,
         primary_file_guid,
         file_guid,
         self.file_part,
         self.directory_position,
         self.metadata_position,
         self.update_pending,
         self.attachment_directory_position,
         ) = struct.unpack('<iiii16s16siqqiq', fh.read(80))
        self.version = (major, minor)
        self.update_pending = bool(self.update_pending)
        self.primary_file_guid = uuid.UUID(bytes=primary_file_guid)
        self.file_guid = uuid.UUID(bytes=file_guid)

    def __str__(self):
        return "FileHeaderSegment\n " + "\n ".join(
            "%s %s" % (name, str(getattr(self, name)))
            for name in FileHeaderSegment.__slots__)


class MetadataSegment(object):
    """ZISRAWMETADATA segment data.

    Contains global image metadata in UTF-8 encoded XML format.

    """
    __slots__ = 'xml_size', 'attachment_size', 'xml_offset', '_fh'

    SID = b'ZISRAWMETADATA'

    def __init__(self, fh):
        self.xml_size, self.attachment_size = struct.unpack('<ii', fh.read(8))
        fh.seek(248, 1)  # spare
        self.xml_offset = fh.tell()
        self._fh = fh

    def data(self, raw=False):
        """Read XML from file and return as unicode string."""
        self._fh.seek(self.xml_offset)
        data = self._fh.read(self.xml_size)
        if raw:
            return data
        data = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
        return unicode(data, 'utf-8')

    def __str__(self):
        return "MetadataSegment\n %s" % self.data()


class SubBlockSegment(object):
    """ZISRAWSUBBLOCK segment data.

    Contains XML metadata, optional attachments, and homogenous,
    contiguous pixel data.

    """
    __slots__ = ('metadata_size', 'attachment_size', 'data_size',
                 'directory_entry', 'data_offset', '_fh')

    SID = b'ZISRAWSUBBLOCK'

    def __init__(self, fh):
        """Read ZISRAWSUBBLOCK segment data from file."""
        with fh.lock:
            (self.metadata_size,
             self.attachment_size,
             self.data_size,
             ) = struct.unpack('<iiq', fh.read(16))
            self.directory_entry = DirectoryEntryDV(fh)
            # fh.seek(max(240 - self.directory_entry.storage_size, 0), 1)
            # self.metadata = unicode(fh.read(self.metadata_size), 'utf-8')
            self.data_offset = fh.tell()
        self.data_offset += max(240 - self.directory_entry.storage_size, 0)
        self.data_offset += self.metadata_size
        self._fh = fh

    def metadata(self):
        """Read metadata from file and return as XML string."""
        fh = self._fh
        with fh.lock:
            fh.seek(self.data_offset - self.metadata_size)
            metadata = unicode(fh.read(self.metadata_size), 'utf-8')
        return metadata

    def data(self, raw=False, resize=True, order=0):
        """Read image data from file and return as numpy array."""
        de = self.directory_entry
        fh = self._fh
        if raw:
            with fh.lock:
                fh.seek(self.data_offset)
                data = fh.read(self.data_size)
            return data
        elif de.compression:
            if de.compression not in DECOMPRESS:
                raise ValueError("compression unknown or not supported")
            with fh.lock:
                fh.seek(self.data_offset)
                data = fh.read(self.data_size)
            data = DECOMPRESS[de.compression](data)
            if de.compression == 2:
                # LZW
                data = numpy.fromstring(data, de.dtype)
        else:
            dtype = numpy.dtype(de.dtype)
            with fh.lock:
                fh.seek(self.data_offset)
                data = fh.read_array(dtype, self.data_size // dtype.itemsize)

        data = data.reshape(de.stored_shape)
        if de.stored_shape == de.shape or not resize:
            return data

        # sub / supersampling
        factors = [j / i for i, j in zip(de.stored_shape, de.shape)]
        factors = [(int(round(f)) if abs(f-round(f)) < 0.0001 else f)
                   for f in factors]

        # use repeat if possible
        if order == 0 and all(isinstance(f, int) for f in factors):
            data = repeat_nd(data, factors).copy()
            data.shape = de.shape
            return data

        # remove leading dimensions with size 1 for speed
        shape = list(de.stored_shape)
        i = 0
        for s in shape:
            if s != 1:
                break
            i += 1
        shape = shape[i:]
        factors = factors[i:]
        data.shape = shape

        # resize RGB components separately for speed
        if shape[-1] in (3, 4) and factors[-1] == 1.0:
            factors = factors[:-1]
            old = data
            data = numpy.empty(de.shape, de.dtype[-2:])
            for i in range(shape[-1]):
                data[..., i] = zoom(old[..., i], zoom=factors, order=order)
        else:
            data = zoom(data, zoom=factors, order=order)

        data.shape = de.shape
        return data

    def attachments(self):
        """Read optional attachments from file and return as bytes."""
        if self.attachment_size < 1:
            return b''
        fh = self._fh
        with fh.lock:
            fh.seek(self.data_offset + self.data_size)
            attachments = fh.read(self.attachment_size)
        return attachments

    def __getattr__(self, name):
        """Directly access DirectoryEntryDV attributes."""
        return getattr(self.directory_entry, name)

    def __str__(self):
        return "SubBlockSegment\n %s\n %s" % (
            self.metadata(), str(self.directory_entry))


class DirectoryEntryDV(object):
    """Directory Entry - Schema DV."""

    # __slots__ = ('file_position', 'file_part', 'compression', 'pyramid_type',
    #             'dimension_entries', 'dtype', 'shape', 'stored_shape',
    #             'axes', 'mosaic_index', 'storage_size', 'start', '_fh')

    @staticmethod
    def read_file_position(fh):
        """Return file position of associated SubBlock segment."""
        (schema_type,
         file_position,
         dimensions_count,
         ) = struct.unpack('<2s4xq14xi', fh.read(32))
        fh.seek(dimensions_count * 20, 1)
        assert(schema_type == b'DV')
        return file_position

    def __init__(self, fh):
        """ """
        self._fh = fh

        (schema_type,
         pixel_type,
         self.file_position,
         self.file_part,  # reserved
         self.compression,
         self.pyramid_type,  # internal
         reserved1,
         reserved2,
         dimensions_count,
         ) = struct.unpack('<2siqiiBB4si', fh.read(32))

        if schema_type != b'DV':
            raise ValueError("not a DirectoryEntryDV")
        self.dtype = PIXEL_TYPE[pixel_type]

        # reverse dimension_entries to match C contiguous data
        self.dimension_entries = list(reversed(
            [DimensionEntryDV1(fh) for _ in range(dimensions_count)]))

    @lazyattr
    def storage_size(self):
        return 32 + len(self.dimension_entries) * 20

    @lazyattr
    def pixel_type(self):
        return PIXEL_TYPE[self.dtype]

    @lazyattr
    def axes(self):
        axes = b''.join(dim.dimension for dim in self.dimension_entries
                        if dim.dimension != b'M')
        return bytes2str(axes + b'0')

    @lazyattr
    def shape(self):
        shape = tuple(dim.size for dim in self.dimension_entries
                      if dim.dimension != b'M')
        sampleshape = numpy.dtype(self.dtype).shape
        return shape + (sampleshape if sampleshape else (1,))

    @lazyattr
    def start(self):
        start = tuple(dim.start for dim in self.dimension_entries
                      if dim.dimension != b'M')
        return start + (0,)

    @lazyattr
    def stored_shape(self):
        shape = tuple(dim.stored_size for dim in self.dimension_entries
                      if dim.dimension != b'M')
        sampleshape = numpy.dtype(self.dtype).shape
        return shape + (sampleshape if sampleshape else (1,))

    @lazyattr
    def mosaic_index(self):
        for dim in self.dimension_entries:
            if dim.dimension == b'M':
                return dim.start

    def data_segment(self):
        """Read and return SubBlockSegment at file_position."""
        # return Segment(self._fh, self.file_position).data()
        fh = self._fh
        with fh.lock:
            fh.seek(self.file_position)
            try:
                sid, _, _ = struct.unpack('<16sqq', fh.read(32))
            except struct.error:
                raise SegmentNotFoundError("can not read ZISRAW segment")
            sid = stripnull(sid)
            if sid not in SEGMENT_ID:
                raise SegmentNotFoundError("not a ZISRAW segment")
            data_segment = SEGMENT_ID[sid](fh)
        return data_segment

    def __str__(self):
        return "DirectoryEntryDV\n  %s %s %s %s\n  %s" % (
            COMPRESSION.get(self.compression, self.compression),
            self.pixel_type, self.axes, str(self.shape),
            "\n  ".join(str(d) for d in self.dimension_entries))


class DimensionEntryDV1(object):
    """Dimension Entry - Schema DV."""

    __slots__ = 'dimension', 'start', 'size', 'start_coordinate', 'stored_size'

    def __init__(self, fh):
        (self.dimension,
         self.start,
         self.size,
         self.start_coordinate,
         stored_size
         ) = struct.unpack('<4siifi', fh.read(20))
        self.dimension = stripnull(self.dimension)
        self.stored_size = stored_size if stored_size else self.size

    def __str__(self):
        return "DimensionEntryDV1 %s %i %i %f %i" % (
            self.dimension, self.start, self.size,
            self.start_coordinate, self.stored_size)


class SubBlockDirectorySegment(object):
    """ZISRAWDIRECTORY segment data.

    Contains entries of any kind, currently only DirectoryEntryDV.

    """
    __slots__ = 'entries',

    SID = b'ZISRAWDIRECTORY'

    @staticmethod
    def file_positions(fh):
        """Return list of file positions of associated SubBlock segments."""
        entry_count = struct.unpack('<i', fh.read(4))[0]
        fh.seek(124, 1)  # reserved
        return tuple(DirectoryEntryDV.read_file_position(fh)
                     for _ in range(entry_count))

    def __init__(self, fh):
        entry_count = struct.unpack('<i', fh.read(4))[0]
        fh.seek(124, 1)  # reserved
        self.entries = tuple(DirectoryEntryDV(fh) for _ in range(entry_count))

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, key):
        return self.entries[key]

    def __iter__(self):
        return iter(self.entries)

    def __str__(self):
        return "SubBlockDirectorySegment\n %s" % (
            "\n ".join(str(e) for e in self.entries))


class AttachmentSegment(object):
    """ZISRAWATTACH segment data.

    Contains binary or text data as specified in attachment_entry.

    """
    __slots__ = 'data_size', 'attachment_entry', 'data_offset', '_fh'

    SID = b'ZISRAWATTACH'

    def __init__(self, fh):
        self.data_size = struct.unpack('<i', fh.read(4))[0]
        fh.seek(12, 1)  # reserved
        self.attachment_entry = AttachmentEntryA1(fh)
        fh.seek(112, 1)  # reserved
        self.data_offset = fh.tell()
        self._fh = fh

    def save(self, filename=None, directory='.'):
        """Save attachment to file in directory."""
        self._fh.seek(self.data_offset)
        if not filename:
            filename = self.attachment_entry.filename
        filename = os.path.join(directory, filename)
        with open(filename, 'wb') as fh:
            fh.write(self._fh.read(self.data_size))

    def data(self, raw=False):
        """Read embedded file and return content.

        If 'raw' is False (default), try return content according to
        CONTENT_FILE_TYPE, else return raw bytes.

        """
        self._fh.seek(self.data_offset)
        cotype = self.attachment_entry.content_file_type
        if not raw and cotype in CONTENT_FILE_TYPE:
            return CONTENT_FILE_TYPE[cotype](self._fh, filesize=self.data_size)
        else:
            return self._fh.read(self.data_size)

    def __str__(self):
        return "AttachmentSegment\n %s" % self.attachment_entry


class AttachmentEntryA1(object):
    """AttachmentEntry - Schema A1."""

    __slots__ = ('content_guid', 'content_file_type', 'name',
                 'file_position', '_fh')

    @staticmethod
    def read_file_position(fh):
        """Return file position of associated Attachment segment."""
        schema_type, file_position = struct.unpack('<2s10xq', fh.read(20))
        fh.seek(108, 1)
        assert(schema_type == b'A1')
        return file_position

    def __init__(self, fh):
        (shema_type,
         reserved,
         self.file_position,
         file_part,  # reserved
         content_guid,
         content_file_type,
         name
         ) = struct.unpack('<2s10sqi16s8s80s', fh.read(128))

        if shema_type != b'A1':
            raise ValueError("not a AttachmentEntryA1")
        self.content_guid = uuid.UUID(bytes=content_guid)
        self.content_file_type = stripnull(content_file_type)
        self.name = unicode(stripnull(name), 'utf-8')
        self._fh = fh

    @property
    def filename(self):
        """Return unique file name for attachment."""
        return "%s@%i.%s" % (self.name, self.file_position,
                             unicode(self.content_file_type, 'utf-8').lower())

    def data_segment(self):
        """Read and return AttachmentSegment at file_position."""
        return Segment(self._fh, self.file_position).data()

    def __str__(self):
        return " ".join(str(i) for i in (
            "AttachmentEntryA1", self.name, self.content_file_type,
            self.content_guid))


class AttachmentDirectorySegment(object):
    """ZISRAWATTDIR segment data. Sequence of AttachmentEntryA1."""

    __slots__ = 'entries',

    SID = b'ZISRAWATTDIR'

    @staticmethod
    def file_positions(fh):
        """Return list of file positions of associated Attachment segments."""
        entry_count = struct.unpack('<i', fh.read(4))[0]
        fh.seek(252, 1)
        return tuple(AttachmentEntryA1.read_file_position(fh)
                     for _ in range(entry_count))

    def __init__(self, fh):
        entry_count = struct.unpack('<i', fh.read(4))[0]
        fh.seek(252, 1)
        self.entries = tuple(AttachmentEntryA1(fh) for _ in range(entry_count))

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, key):
        return self.entries[key]

    def __iter__(self):
        return iter(self.entries)

    def __str__(self):
        return "AttachmentDirectorySegment\n %s" % (
            "\n ".join(str(i) for i in self.entries))


class DeletedSegment(object):
    """DELETED segment data. Ignore."""

    __slots__ = ()

    SID = b'DELETED'

    def __init__(self, fh):
        pass

    def __str__(self):
        return "DeletedSegment"


class UnknownSegment(object):
    """Unknown segment data. Ignore."""

    __slots__ = ()

    def __init__(self, fh):
        pass

    def __str__(self):
        return "UnknownSegment"


class TimeStamps(object):
    """CZTIMS TimeStamps content schema.

    Contains sequence of floting point numbers, i.e. seconds relative
    to start time of acquisition.

    """
    __slots__ = 'time_stamps',

    def __init__(self, fh, filesize=None):
        size, number = struct.unpack('<ii', fh.read(8))
        self.time_stamps = struct.unpack('<%id' % number, fh.read(8 * number))

    def __len__(self):
        return len(self.time_stamps)

    def __getitem__(self, key):
        return self.time_stamps[key]

    def __iter__(self):
        return iter(self.time_stamps)

    def __str__(self):
        return str(self.time_stamps)


class FocusPositions(object):
    """CZFOC FocusPositions content schema.

    Contains sequence of floting point numbers, i.e. micrometers relative
    to Z start position of acquisition.

    """
    __slots__ = 'positions',

    def __init__(self, fh, filesize=None):
        size, number = struct.unpack('<ii', fh.read(8))
        self.positions = struct.unpack('<%id' % number, fh.read(8 * number))

    def __len__(self):
        return len(self.positions)

    def __getitem__(self, key):
        return self.positions[key]

    def __iter__(self):
        return iter(self.positions)

    def __str__(self):
        return str(self.positions)


class EventList(object):
    """CZEVL EventList content schema. Sequence of EventListEntry."""

    __slots__ = 'events',

    def __init__(self, fh, filesize=None):
        size, number = struct.unpack('<ii', fh.read(8))
        self.events = [EventListEntry(fh) for _ in range(number)]

    def __len__(self):
        return len(self.events)

    def __getitem__(self, key):
        return self.events[key]

    def __iter__(self):
        return iter(self.events)

    def __str__(self):
        return "\n ".join(str(event) for event in self.events)


class EventListEntry(object):
    """EventListEntry content schema."""

    __slots__ = 'time', 'event_type', 'description'

    EV_TYPE = {0: 'MARKER', 1: 'TIME_CHANGE', 2: 'BLEACH_START',
               3: 'BLEACH_STOP', 4: 'TRIGGER'}

    def __init__(self, fh):
        (size,
         self.time,
         self.event_type,
         description_size,
         ) = struct.unpack('<idii', fh.read(20))
        description = stripnull(fh.read(description_size))
        self.description = unicode(description, 'utf-8')

    def __str__(self):
        return "%s @ %s (%s)" % (EventListEntry.EV_TYPE[self.event_type],
                                 self.time, self.description)


class LookupTables(object):
    """CZLUT LookupTables content schema. Sequence of LookupTableEntry."""

    __slots__ = 'lookup_tables',

    def __init__(self, fh, filesize=None):
        size, number = struct.unpack('<ii', fh.read(8))
        self.lookup_tables = [LookupTableEntry(fh) for _ in range(number)]

    def __len__(self):
        return len(self.lookup_tables)

    def __getitem__(self, key):
        return self.lookup_tables[key]

    def __iter__(self):
        return iter(self.lookup_tables)

    def __str__(self):
        return "LookupTables\n %s" % str(self.lookup_tables)


class LookupTableEntry(object):
    """LookupTableEntry content schema. Sequence of ComponentEntry."""

    __slots__ = 'identifier', 'components'

    def __init__(self, fh):
        size, identifier, number = struct.unpack('<i80si', fh.read(88))
        self.identifier = unicode(stripnull(identifier), 'utf-8')
        self.components = [ComponentEntry(fh) for _ in range(number)]

    def __len__(self):
        return len(self.components)

    def __getitem__(self, key):
        return self.components[key]

    def __iter__(self):
        return iter(self.components)

    def __str__(self):
        return "LookupTableEntry\n %s\n %s" % (
            self.identifier, "\n ".join(str(i) for i in self.components))


class ComponentEntry(object):
    """ComponentEntry content schema."""

    __slots__ = 'component_type', 'intensity'

    CO_TYPE = {-1: 'RGB', 1: 'RED', 2: 'GREEN', 3: 'BLUE'}

    def __init__(self, fh):
        size, self.component_type, number = struct.unpack('<iii', fh.read(12))
        self.intensity = fh.fromfile(dtype='<i2', count=number//2)
        if self.component_type == -1:
            self.intensity = self.intensity.reshape(-1, 3)

    def __str__(self):
        return "ComponentEntry %s %s" % (
            ComponentEntry.CO_TYPE[self.component_type],
            str(self.intensity.shape))


def xml_reader(fh, filesize):
    """Read XML from file and return as xml.ElementTree root Element."""
    xml = unicode(stripnull(fh.read(filesize)), 'utf-8')
    return etree.fromstring(xml)


def match_filename(filename):
    """Return master file name and file part number from CZI file name."""
    match = re.search(r'(.*?)(?:\((\d+)\))?\.czi$',
                      filename, re.IGNORECASE).groups()
    name = match[0] + '.czi'
    part = int(match[1]) if len(match) > 1 else 0
    return name, part


def decode_jxr(data):
    """Decode JXR data stream into ndarray."""
    return _czifile.decode_jxr(data)


def decode_jpeg(data):
    """Decode JPEG data stream into ndarray."""
    return _czifile.decode_jpeg(data)


# map Segment.sid to data reader
SEGMENT_ID = {
    FileHeaderSegment.SID: FileHeaderSegment,
    SubBlockDirectorySegment.SID: SubBlockDirectorySegment,
    SubBlockSegment.SID: SubBlockSegment,
    MetadataSegment.SID: MetadataSegment,
    AttachmentSegment.SID: AttachmentSegment,
    AttachmentDirectorySegment.SID: AttachmentDirectorySegment,
    DeletedSegment.SID: DeletedSegment,
}

# map AttachmentEntryA1.content_file_type to attachment reader.
CONTENT_FILE_TYPE = {
    b'CZI': CziFile,
    b'ZISRAW': CziFile,
    b'CZTIMS': TimeStamps,
    b'CZEVL': EventList,
    b'CZLUT': LookupTables,
    b'CZFOC': FocusPositions,
    b'CZEXP': xml_reader,  # Experiment
    b'CZHWS': xml_reader,  # HardwareSetting
    b'CZMVM': xml_reader,  # MultiviewMicroscopy
    # b'CZPML': PalMoleculeList,  # undocumented
    # b'ZIP'
    # b'JPG'
}

# map DirectoryEntryDV.pixeltype to numpy dtypes
PIXEL_TYPE = {
    0: '<u1', 'Gray8': '<u1', '<u1': 'Gray8',
    1: '<u2', 'Gray16': '<u2', '<u2': 'Gray16',
    2: '<f4', 'Gray32Float': '<f4', '<f4': 'Gray32Float',
    3: '<3u1', 'Bgr24': '<3u1', '<3u1': 'Bgr24',
    4: '<3u2', 'Bgr48': '<3u2', '<3u2': 'Bgr48',
    8: '<3f4', 'Bgr96Float': '<3f4', '<3f4': 'Bgr96Float',
    9: '<4u1', 'Bgra32': '<4u1', '<4u1': 'Bgra32',
    10: '<F8', 'Gray64ComplexFloat': '<F8', '<F8': 'Gray64ComplexFloat',
    11: '<3F8', 'Bgr192ComplexFloat': '<3F8', '<3F8': 'Bgr192ComplexFloat',
    12: '<i4', 'Gray32': '<i4', '<i4': 'Gray32',
    13: '<i8', 'Gray64': '<i8', '<i8': 'Gray64',
}


# map dimension character to description
DIMENSIONS = {
    '0': 'Sample',  # e.g. RGBA
    'X': 'Width',
    'Y': 'Height',
    'C': 'Channel',
    'Z': 'Slice',  # depth
    'T': 'Time',
    'R': 'Rotation',
    'S': 'Scene',
    'I': 'Illumination',  # direction
    'B': 'Block',  # acquisition
    'M': 'Mosaic',  # tile
    'H': 'Phase',
    'V': 'View',
}

# map DirectoryEntryDV.compression to description
COMPRESSION = {
    0: "Uncompressed",
    1: "JpgFile",
    2: "LZW",
    4: "JpegXrFile",
    # 100 and up: camera/system specific specific RAW data
}

# map DirectoryEntryDV.compression to decompression function
DECOMPRESS = {
    0: lambda x: x,  # uncompressed
    2: decode_lzw,  # LZW
}

if _czifile:
    DECOMPRESS[1] = _czifile.decode_jpeg
    DECOMPRESS[4] = _czifile.decode_jxr


def czi2tif(czifile, tiffile=None, squeeze=True, verbose=True, **kwargs):
    """Convert CZI file to memory-mappable TIFF file.

    To read the image data from the created TIFF file: Read the 'StripOffsets'
    and 'ImageDescription' tags from the first TIFF page. Get the 'dtype' and
    'shape' attributes from the ImageDescription string using a JSON decoder.
    Memory-map 'product(shape) * sizeof(dtype)' bytes in the file starting at
    StripOffsets[0]. Cast the mapped bytes to an array of 'dtype' and 'shape'.

    """
    verbose = print_ if verbose else lambda *a, **b: None

    if tiffile is None:
        tiffile = czifile + '.tif'
    elif tiffile.lower() == 'none':
        tiffile = None

    verbose("\nOpening CZI file... ", end='', flush=True)
    start_time = time.time()

    with CziFile(czifile) as czi:
        if squeeze:
            shape, axes = squeeze_axes(czi.shape, czi.axes, '')
        else:
            shape = czi.shape
            axes = czi.axes
        dtype = str(czi.dtype)
        size = product(shape) * czi.dtype.itemsize

        verbose("%.3f s" % (time.time() - start_time))
        verbose("Image\n  axes:  %s\n  shape: %s\n  dtype: %s\n  size:  %s"
                % (axes, shape, dtype, format_size(size)), flush=True)

        if not tiffile:
            verbose("Copying image from CZI file to RAM... ",
                    end='', flush=True)
            start_time = time.time()
            czi.asarray(order=0)
        else:
            verbose("Creating empty TIF file... ", end='', flush=True)
            start_time = time.time()
            if 'software' not in kwargs:
                kwargs['software'] = 'czi2tif'
            metadata = kwargs.pop('metadata', {})
            metadata.update(axes=axes, dtype=dtype)
            data = memmap(tiffile, shape=shape, dtype=dtype,
                          metadata=metadata, **kwargs)
            data = data.reshape(czi.shape)
            verbose("%.3f s" % (time.time() - start_time))
            verbose("Copying image from CZI to TIF file... ",
                    end='', flush=True)
            start_time = time.time()
            czi.asarray(order=0, out=data)
        verbose("%.3f s" % (time.time() - start_time), flush=True)


if sys.version_info[0] == 2:
    def print_(*args, **kwargs):
        """Print function with flush support."""
        flush = kwargs.pop('flush', False)
        print(*args, **kwargs)
        if flush:
            sys.stdout.flush()

    def bytes2str(b, encoding=None):
        """Return string from bytes."""
        return b
else:
    basestring = str, bytes
    unicode = str
    print_ = print

    def bytes2str(b, encoding='cp1252'):
        """Return unicode string from bytes."""
        return str(b, encoding)


if __name__ == "__main__":
    import doctest
    numpy.set_printoptions(suppress=True, precision=5)
    doctest.testmod()
