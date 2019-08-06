# Python-bioformats is distributed under the GNU General Public
# License, but this file is licensed under the more permissive BSD
# license.  See the accompanying file LICENSE for details.
#
# Copyright (c) 2009-2014 Broad Institute
# All rights reserved.

"""
omexml.py read and write OME xml
"""

from __future__ import absolute_import, unicode_literals

import sys
import xml.etree.ElementTree as ElementTree

from io import BytesIO

import datetime
import logging
from functools import reduce
import re
import uuid
import numpy as np  # for ometypedict

logger = logging.getLogger(__file__)


def xsd_now():
    """Return the current time in xsd:dateTime format"""
    return datetime.datetime.now().isoformat()


DEFAULT_NOW = xsd_now()
#
# The namespaces
#
NS_BINARY_FILE = "http://www.openmicroscopy.org/Schemas/BinaryFile/2013-06"
NS_ORIGINAL_METADATA = "openmicroscopy.org/OriginalMetadata"
NS_DEFAULT = "http://www.openmicroscopy.org/Schemas/{ns_key}/2013-06"
NS_RE = r"http://www.openmicroscopy.org/Schemas/(?P<ns_key>.*)/[0-9/-]"

default_xml = """<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Warning: this comment is an OME-XML metadata block, which contains crucial dimensional parameters and other important metadata. Please edit cautiously (if at all), and back up the original data before doing so. For more information, see the OME-TIFF web site: http://ome-xml.org/wiki/OmeTiff. -->
<OME xmlns="{ns_ome_default}"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.openmicroscopy.org/Schemas/OME/2013-06 http://www.openmicroscopy.org/Schemas/OME/2012-03/ome.xsd">
  <Image ID="Image:0" Name="default.png">
    <AcquisitionDate>{timestamp}</AcquisitionDate>
    <Pixels DimensionOrder="XYCTZ"
            ID="Pixels:0"
            SizeC="1"
            SizeT="1"
            SizeX="512"
            SizeY="512"
            SizeZ="1"
            Type="uint8">
<Channel ID="Channel:0:0" SamplesPerPixel="1">
        <LightPath/>
      </Channel>
    </Pixels>
  </Image>
</OME>""".format(ns_ome_default=NS_DEFAULT.format(ns_key='ome'), timestamp=xsd_now())

#
# These are the OME-XML pixel types - not all supported by subimager
#
PT_INT8 = "int8"
PT_INT16 = "int16"
PT_INT32 = "int32"
PT_UINT8 = "uint8"
PT_UINT16 = "uint16"
PT_UINT32 = "uint32"
PT_FLOAT = "float"
PT_BIT = "bit"
PT_DOUBLE = "double"
PT_COMPLEX = "complex"
PT_DOUBLECOMPLEX = "double-complex"
ometypedict = {
    np.dtype(np.int8): PT_INT8,
    np.dtype(np.int16): PT_INT16,
    np.dtype(np.int32): PT_INT32,
    np.dtype(np.uint8): PT_UINT8,
    np.dtype(np.uint16): PT_UINT16,
    np.dtype(np.uint32): PT_UINT32,
    np.dtype(np.float32): PT_FLOAT,
    np.dtype(np.float64): PT_DOUBLE,
    np.dtype(np.complex64): PT_COMPLEX,
    np.dtype(np.complex128): PT_DOUBLECOMPLEX
}


def get_pixel_type(npdtype):
    ptype = ometypedict.get(npdtype)
    if ptype is None:
        raise ValueError('OMEXML get_pixel_type unknown type: ' + npdtype.name)
    return ptype


#
# The allowed dimension types
#
DO_XYZCT = "XYZCT"
DO_XYZTC = "XYZTC"
DO_XYCTZ = "XYCTZ"
DO_XYCZT = "XYCZT"
DO_XYTCZ = "XYTCZ"
DO_XYTZC = "XYTZC"
#
# Original metadata corresponding to TIFF tags
# The text for these can be found in
# loci.formats.in.BaseTiffReader.initStandardMetadata
#
'''IFD # 254'''
OM_NEW_SUBFILE_TYPE = "NewSubfileType"
'''IFD # 256'''
OM_IMAGE_WIDTH = "ImageWidth"
'''IFD # 257'''
OM_IMAGE_LENGTH = "ImageLength"
'''IFD # 258'''
OM_BITS_PER_SAMPLE = "BitsPerSample"

'''IFD # 262'''
OM_PHOTOMETRIC_INTERPRETATION = "PhotometricInterpretation"
PI_WHITE_IS_ZERO = "WhiteIsZero"
PI_BLACK_IS_ZERO = "BlackIsZero"
PI_RGB = "RGB"
PI_RGB_PALETTE = "Palette"
PI_TRANSPARENCY_MASK = "Transparency Mask"
PI_CMYK = "CMYK"
PI_Y_CB_CR = "YCbCr"
PI_CIE_LAB = "CIELAB"
PI_CFA_ARRAY = "Color Filter Array"

'''BioFormats infers the image type from the photometric interpretation'''
OM_METADATA_PHOTOMETRIC_INTERPRETATION = "MetaDataPhotometricInterpretation"
MPI_RGB = "RGB"
MPI_MONOCHROME = "Monochrome"
MPI_CMYK = "CMYK"

'''IFD # 263'''
OM_THRESHHOLDING = "Threshholding" # (sic)
'''IFD # 264 (but can be 265 if the orientation = 8)'''
OM_CELL_WIDTH = "CellWidth"
'''IFD # 265'''
OM_CELL_LENGTH = "CellLength"
'''IFD # 266'''
OM_FILL_ORDER = "FillOrder"
'''IFD # 279'''
OM_DOCUMENT_NAME = "Document Name"
'''IFD # 271'''
OM_MAKE = "Make"
'''IFD # 272'''
OM_MODEL = "Model"
'''IFD # 274'''
OM_ORIENTATION = "Orientation"
'''IFD # 277'''
OM_SAMPLES_PER_PIXEL = "SamplesPerPixel"
'''IFD # 280'''
OM_MIN_SAMPLE_VALUE = "MinSampleValue"
'''IFD # 281'''
OM_MAX_SAMPLE_VALUE = "MaxSampleValue"
'''IFD # 282'''
OM_X_RESOLUTION = "XResolution"
'''IFD # 283'''
OM_Y_RESOLUTION = "YResolution"
'''IFD # 284'''
OM_PLANAR_CONFIGURATION = "PlanarConfiguration"
PC_CHUNKY = "Chunky"
PC_PLANAR = "Planar"

'''IFD # 286'''
OM_X_POSITION = "XPosition"
'''IFD # 287'''
OM_Y_POSITION = "YPosition"
'''IFD # 288'''
OM_FREE_OFFSETS = "FreeOffsets"
'''IFD # 289'''
OM_FREE_BYTECOUNTS = "FreeByteCounts"
'''IFD # 290'''
OM_GRAY_RESPONSE_UNIT = "GrayResponseUnit"
'''IFD # 291'''
OM_GRAY_RESPONSE_CURVE = "GrayResponseCurve"
'''IFD # 292'''
OM_T4_OPTIONS = "T4Options"
'''IFD # 293'''
OM_T6_OPTIONS = "T6Options"
'''IFD # 296'''
OM_RESOLUTION_UNIT = "ResolutionUnit"
'''IFD # 297'''
OM_PAGE_NUMBER = "PageNumber"
'''IFD # 301'''
OM_TRANSFER_FUNCTION = "TransferFunction"

'''IFD # 305'''
OM_SOFTWARE = "Software"
'''IFD # 306'''
OM_DATE_TIME = "DateTime"
'''IFD # 315'''
OM_ARTIST = "Artist"
'''IFD # 316'''
OM_HOST_COMPUTER = "HostComputer"
'''IFD # 317'''
OM_PREDICTOR = "Predictor"
'''IFD # 318'''
OM_WHITE_POINT = "WhitePoint"
'''IFD # 322'''
OM_TILE_WIDTH = "TileWidth"
'''IFD # 323'''
OM_TILE_LENGTH = "TileLength"
'''IFD # 324'''
OM_TILE_OFFSETS = "TileOffsets"
'''IFD # 325'''
OM_TILE_BYTE_COUNT = "TileByteCount"
'''IFD # 332'''
OM_INK_SET = "InkSet"
'''IFD # 33432'''
OM_COPYRIGHT = "Copyright"
#
# Well row/column naming conventions
#
NC_LETTER = "letter"
NC_NUMBER = "number"


def page_name_original_metadata(index):
    """Get the key name for the page name metadata data for the indexed tiff page

    These are TIFF IFD #'s 285+

    index - zero-based index of the page
    """
    return "PageName #%d" % index


def get_text(node):
    """Get the contents of text nodes in a parent node"""
    return node.text


def set_text(node, text):
    """Set the text of a parent"""
    node.text = text


def qn(namespace, tag_name):
    """Return the qualified name for a given namespace and tag name

    This is the ElementTree representation of a qualified name
    """
    return "{%s}%s" % (namespace, tag_name)


def split_qn(qn):
    """Split a qualified tag name or return None if namespace not present"""
    m = re.match('\{(.*)\}(.*)', qn)
    if m:
        return m.group(1), m.group(2)
    return None


def get_namespaces(node):
    """Get top-level XML namespaces from a node."""
    ns_lib = {'ome': None, 'sa': None, 'spw': None}
    for child in node.iter():
        nsmatch = split_qn(child.tag)
        if nsmatch is not None:
            ns = nsmatch[0]
            match = re.match(NS_RE, ns)
            if match:
                ns_key = match.group('ns_key').lower()
                ns_lib[ns_key] = ns
    return ns_lib


def get_float_attr(node, attribute):
    """Cast an element attribute to a float or return None if not present"""
    attr = node.get(attribute)
    return None if attr is None else float(attr)


def get_int_attr(node, attribute):
    """Cast an element attribute to an int or return None if not present"""
    attr = node.get(attribute)
    return None if attr is None else int(attr)


def make_text_node(parent, namespace, tag_name, text):
    """Either make a new node and add the given text or replace the text

    parent - the parent node to the node to be created or found
    namespace - the namespace of the node's qualified name
    tag_name - the tag name of  the node's qualified name
    text - the text to be inserted
    """
    qname = qn(namespace, tag_name)
    node = parent.find(qname)
    if node is None:
        node = ElementTree.SubElement(parent, qname)
    set_text(node, text)


class OMEXML(object):
    """Reads and writes OME-XML with methods to get and set it.

    The OMEXML class has four main purposes: to parse OME-XML, to output
    OME-XML, to provide a structured mechanism for inspecting OME-XML and to
    let the caller create and modify OME-XML.

    There are two ways to invoke the constructor. If you supply XML as a string
    or unicode string, the constructor will parse it and will use it as the
    base for any inspection and modification. If you don't supply XML, you'll
    get a bland OME-XML object which has a one-channel image. You can modify
    it programatically and get the modified OME-XML back out by calling to_xml.

    There are two ways to get at the XML. The arduous way is to get the
    root_node of the DOM and explore it yourself using the DOM API
    (http://docs.python.org/library/xml.dom.html#module-xml.dom). The easy way,
    where it's supported is to use properties on OMEXML and on some of its
    derived objects. For instance:

    >>> o = OMEXML()
    >>> print o.image().AcquisitionDate

    will get you the date that image # 0 was acquired.

    >>> o = OMEXML()
    >>> o.image().Name = "MyImage"

    will set the image name to "MyImage".

    You can add and remove objects using the "count" properties. Each of these
    handles hooking up and removing orphaned elements for you and should be
    less error prone than creating orphaned elements and attaching them. For
    instance, to create a three-color image:

    >>> o = OMEXML()
    >>> o.image().Pixels.channel_count = 3
    >>> o.image().Pixels.Channel(0).Name = "Red"
    >>> o.image().Pixels.Channel(1).Name = "Green"
    >>> o.image().Pixels.Channel(2).Name = "Blue"

    See the `OME-XML schema documentation
    <http://git.openmicroscopy.org/src/develop/components/specification/Documentation/Generated/OME-2011-06/ome.html>`.

    """
    def __init__(self, xml=None, rootnode=None):
        if xml is None and rootnode is None:
            xml = default_xml
        if rootnode is None:
            if sys.platform.startswith('win'):
                enc = 'ISO-8859-1'
            else:
                enc = 'UTF-8'
            self.dom = ElementTree.fromstring(xml, ElementTree.XMLParser(encoding=enc))
        else:
            self.dom = rootnode

        # determine OME namespaces
        self.ns = get_namespaces(self.dom)
        if __name__ == '__main__':
            if self.ns['ome'] is None:
                raise Exception("Error: String not in OME-XML format")

        # generate a uuid if there is none
        # < OME UUID = "urn:uuid:ef8af211-b6c1-44d4-97de-daca46f16346"
        omeElem = self.dom
        if not omeElem.get('UUID'):
            omeElem.set('UUID', 'urn:uuid:'+str(uuid.uuid4()))
        self.uuidStr = omeElem.get('UUID')

    def __str__(self):
        #
        # need to register the ome namespace because BioFormats expects
        # that namespace to be the default or to be explicitly named "ome"
        #

        for ns_key in ["ome"]:
            ns = self.ns.get(ns_key) or NS_DEFAULT.format(ns_key=ns_key)
            # ElementTree.register_namespace(ns_key, ns)
            ElementTree.register_namespace('', ns)
        # ElementTree.register_namespace("om", NS_ORIGINAL_METADATA)
        result = BytesIO()
        ElementTree.ElementTree(self.root_node).write(result,
                                                      encoding='utf-8',
                                                      method="xml",
                                                      xml_declaration=True
                                                      # default_namespace = 'http://www.openmicroscopy.org/Schemas/ome/2013-06'
                                                      )
        return result.getvalue().decode()

    def to_xml(self, indent="\t", newline="\n", encoding="utf-8"):
        return str(self)

    def get_ns(self, key):
        return self.ns[key]

    @property
    def root_node(self):
        return self.dom

    def get_image_count(self):
        '''The number of images (= series) specified by the XML'''
        return len(self.root_node.findall(qn(self.ns['ome'], "Image")))

    def set_image_count(self, value):
        '''Add or remove image nodes as needed'''
        assert value > 0
        root = self.root_node
        if self.image_count > value:
            image_nodes = root.find(qn(self.ns['ome'], "Image"))
            for image_node in image_nodes[value:]:
                root.remove(image_node)
        while(self.image_count < value):
            new_image = self.Image(ElementTree.SubElement(root, qn(self.ns['ome'], "Image")))
            new_image.ID = str(uuid.uuid4())
            new_image.Name = "default.png"
            new_image.AcquisitionDate = xsd_now()
            new_pixels = self.Pixels(
                ElementTree.SubElement(new_image.node, qn(self.ns['ome'], "Pixels")))
            new_pixels.ome_uuid = self.uuidStr
            new_pixels.ID = str(uuid.uuid4())
            new_pixels.DimensionOrder = DO_XYCTZ
            new_pixels.PixelType = PT_UINT8
            new_pixels.SizeC = 1
            new_pixels.SizeT = 1
            new_pixels.SizeX = 512
            new_pixels.SizeY = 512
            new_pixels.SizeZ = 1
            new_channel = self.Channel(
                ElementTree.SubElement(new_pixels.node, qn(self.ns['ome'], "Channel")))
            new_channel.ID = "Channel%d:0" % self.image_count
            new_channel.Name = new_channel.ID
            new_channel.SamplesPerPixel = 1

    image_count = property(get_image_count, set_image_count)

    @property
    def plates(self):
        return self.PlatesDucktype(self.root_node)

    @property
    def structured_annotations(self):
        """Return the structured annotations container

        returns a wrapping of OME/StructuredAnnotations. It creates
        the element if it doesn't exist.
        """
        node = self.root_node.find(qn(self.ns['sa'], "StructuredAnnotations"))
        if node is None:
            node = ElementTree.SubElement(
                self.root_node, qn(self.ns['sa'], "StructuredAnnotations"))
        return self.StructuredAnnotations(node)

    class Image(object):
        """Representation of the OME/Image element"""
        def __init__(self, node):
            """Initialize with the DOM Image node"""
            self.node = node
            self.ns = get_namespaces(self.node)

        def get_ID(self):
            return self.node.get("ID")

        def set_ID(self, value):
            self.node.set("ID", value)

        ID = property(get_ID, set_ID)

        def get_Name(self):
            return self.node.get("Name")

        def set_Name(self, value):
            self.node.set("Name", value)

        Name = property(get_Name, set_Name)

        def get_AcquisitionDate(self):
            """The date in ISO-8601 format"""
            acquired_date = self.node.find(qn(self.ns["ome"], "AcquisitionDate"))
            if acquired_date is None:
                return None
            return get_text(acquired_date)

        def set_AcquisitionDate(self, date):
            acquired_date = self.node.find(qn(self.ns["ome"], "AcquisitionDate"))
            if acquired_date is None:
                acquired_date = ElementTree.SubElement(
                    self.node, qn(self.ns["ome"], "AcquisitionDate"))
            set_text(acquired_date, date)

        AcquisitionDate = property(get_AcquisitionDate, set_AcquisitionDate)

        @property
        def Pixels(self):
            """The OME/Image/Pixels element.

            Example:
            >>> md = bioformats.omexml.OMEXML(xml)
            >>> pixels = omemetadata.image(i).Pixels
            >>> channel_count = pixels.SizeC
            >>> stack_count = pixels.SizeZ
            >>> timepoint_count = pixels.SizeT

            """
            return OMEXML.Pixels(self.node.find(qn(self.ns['ome'], "Pixels")))

    def image(self, index=0):
        """Return an image node by index"""
        return self.Image(self.root_node.findall(qn(self.ns['ome'], "Image"))[index])

    class Channel(object):
        """The OME/Image/Pixels/Channel element"""
        def __init__(self, node):
            self.node = node
            self.ns = get_namespaces(node)

        def get_ID(self):
            return self.node.get("ID")

        def set_ID(self, value):
            self.node.set("ID", value)
        ID = property(get_ID, set_ID)

        def get_Name(self):
            return self.node.get("Name")

        def set_Name(self, value):
            self.node.set("Name", value)
        Name = property(get_Name, set_Name)

        def get_SamplesPerPixel(self):
            return get_int_attr(self.node, "SamplesPerPixel")

        def set_SamplesPerPixel(self, value):
            self.node.set("SamplesPerPixel", str(value))
        SamplesPerPixel = property(get_SamplesPerPixel, set_SamplesPerPixel)

        def get_Color(self):
            return get_int_attr(self.node, "Color")

        def set_Color(self, value):
            self.node.set("Color", str(value))

        Color = property(get_Color, set_Color)

    class TiffData(object):
        """The OME/Image/Pixels/TiffData element

        <TiffData FirstC="0" FirstT="0" FirstZ="0" IFD="0" PlaneCount="1">
            <UUID FileName="img40_1.ome.tif">urn:uuid:ef8af211-b6c1-44d4-97de-daca46f16346</UUID>
        </TiffData>
        For our purposes, there will be one TiffData per 2-dimensional image plane.
        """
        def __init__(self, node):
            self.node = node
            self.ns = get_namespaces(self.node)

        def get_FirstZ(self):
            '''The Z index of the plane'''
            return get_int_attr(self.node, "FirstZ")

        def set_FirstZ(self, value):
            self.node.set("FirstZ", str(value))

        FirstZ = property(get_FirstZ, set_FirstZ)

        def get_FirstC(self):
            '''The channel index of the plane'''
            return get_int_attr(self.node, "FirstC")

        def set_FirstC(self, value):
            self.node.set("FirstC", str(value))

        FirstC = property(get_FirstC, set_FirstC)

        def get_FirstT(self):
            '''The T index of the plane'''
            return get_int_attr(self.node, "FirstT")

        def set_FirstT(self, value):
            self.node.set("FirstT", str(value))

        FirstT = property(get_FirstT, set_FirstT)

        def get_IFD(self):
            '''plane index within tiff file'''
            return get_int_attr(self.node, "IFD")

        def set_IFD(self, value):
            self.node.set("IFD", str(value))

        IFD = property(get_IFD, set_IFD)

        def get_PlaneCount(self):
            '''How many planes in this TiffData. Should always be 1'''
            return get_int_attr(self.node, "PlaneCount")

        def set_PlaneCount(self, value):
            self.node.set("PlaneCount", str(value))

        PlaneCount = property(get_PlaneCount, set_PlaneCount)

    class Plane(object):
        """The OME/Image/Pixels/Plane element

        The Plane element represents one 2-dimensional image plane. It
        has the Z, C and T indices of the plane and optionally has the
        X, Y, Z, exposure time and a relative time delta.
        """
        def __init__(self, node):
            self.node = node
            self.ns = get_namespaces(self.node)

        def get_TheZ(self):
            """The Z index of the plane"""
            return get_int_attr(self.node, "TheZ")

        def set_TheZ(self, value):
            self.node.set("TheZ", str(value))

        TheZ = property(get_TheZ, set_TheZ)

        def get_TheC(self):
            """The channel index of the plane"""
            return get_int_attr(self.node, "TheC")

        def set_TheC(self, value):
            self.node.set("TheC", str(value))

        TheC = property(get_TheC, set_TheC)

        def get_TheT(self):
            """The T index of the plane"""
            return get_int_attr(self.node, "TheT")

        def set_TheT(self, value):
            self.node.set("TheT", str(value))

        TheT = property(get_TheT, set_TheT)

        def get_DeltaT(self):
            """# of seconds since the beginning of the experiment"""
            return get_float_attr(self.node, "DeltaT")

        def set_DeltaT(self, value):
            self.node.set("DeltaT", str(value))

        DeltaT = property(get_DeltaT, set_DeltaT)

        @property
        def ExposureTime(self):
            """Units are seconds. Duration of acquisition????"""
            exposure_time = self.node.get("ExposureTime")
            if exposure_time is not None:
                return float(exposure_time)
            return None

        def get_PositionX(self):
            """X position of stage"""
            position_x = self.node.get("PositionX")
            if position_x is not None:
                return float(position_x)
            return None

        def set_PositionX(self, value):
            self.node.set("PositionX", str(value))

        PositionX = property(get_PositionX, set_PositionX)

        def get_PositionY(self):
            '''Y position of stage'''
            return get_float_attr(self.node, "PositionY")

        def set_PositionY(self, value):
            self.node.set("PositionY", str(value))

        PositionY = property(get_PositionY, set_PositionY)

        def get_PositionZ(self):
            '''Z position of stage'''
            return get_float_attr(self.node, "PositionZ")

        def set_PositionZ(self, value):
            self.node.set("PositionZ", str(value))

        PositionZ = property(get_PositionZ, set_PositionZ)

    class Pixels(object):
        """The OME/Image/Pixels element

        The Pixels element represents the pixels in an OME image and, for
        an OME-XML encoded image, will actually contain the base-64 encoded
        pixel data. It has the X, Y, Z, C, and T extents of the image
        and it specifies the channel interleaving and channel depth.
        """
        def __init__(self, node):
            self.node = node
            self.ns = get_namespaces(self.node)
            self.ome_uuid = ""
            self.node.set("BigEndian", "true")

        def get_ID(self):
            return self.node.get("ID")

        def set_ID(self, value):
            self.node.set("ID", value)
        ID = property(get_ID, set_ID)

        def get_DimensionOrder(self):
            """The ordering of image planes in the file

            A 5-letter code indicating the ordering of pixels, from the most
            rapidly varying to least. Use the DO_* constants (for instance
            DO_XYZCT) to compare and set this.
            """
            return self.node.get("DimensionOrder")

        def set_DimensionOrder(self, value):
            self.node.set("DimensionOrder", value)

        DimensionOrder = property(get_DimensionOrder, set_DimensionOrder)

        def get_PixelType(self):
            """The pixel bit type, for instance PT_UINT8

            The pixel type specifies the datatype used to encode pixels
            in the image data. You can use the PT_* constants to compare
            and set the pixel type.
            """
            return self.node.get("Type")

        def set_PixelType(self, value):
            self.node.set("Type", value)

        PixelType = property(get_PixelType, set_PixelType)

        def get_SizeX(self):
            """The dimensions of the image in the X direction in pixels"""
            return get_int_attr(self.node, "SizeX")

        def set_SizeX(self, value):
            self.node.set("SizeX", str(value))

        SizeX = property(get_SizeX, set_SizeX)

        def get_SizeY(self):
            """The dimensions of the image in the Y direction in pixels"""
            return get_int_attr(self.node, "SizeY")

        def set_SizeY(self, value):
            self.node.set("SizeY", str(value))

        SizeY = property(get_SizeY, set_SizeY)

        def get_SizeZ(self):
            """The dimensions of the image in the Z direction in pixels"""
            return get_int_attr(self.node, "SizeZ")

        def set_SizeZ(self, value):
            self.node.set("SizeZ", str(value))

        SizeZ = property(get_SizeZ, set_SizeZ)

        def get_SizeT(self):
            """The dimensions of the image in the T direction in pixels"""
            return get_int_attr(self.node, "SizeT")

        def set_SizeT(self, value):
            self.node.set("SizeT", str(value))

        SizeT = property(get_SizeT, set_SizeT)

        def get_SizeC(self):
            """The dimensions of the image in the C direction in pixels"""
            return get_int_attr(self.node, "SizeC")

        def set_SizeC(self, value):
            self.node.set("SizeC", str(value))

        SizeC = property(get_SizeC, set_SizeC)

        def get_PhysicalSizeX(self):
            """The dimensions of the image in the X direction in physical units"""
            return get_float_attr(self.node, "PhysicalSizeX")

        def set_PhysicalSizeX(self, value):
            self.node.set("PhysicalSizeX", str(value))

        PhysicalSizeX = property(get_PhysicalSizeX, set_PhysicalSizeX)

        def get_PhysicalSizeY(self):
            """The dimensions of the image in the Y direction in physical units"""
            return get_float_attr(self.node, "PhysicalSizeY")

        def set_PhysicalSizeY(self, value):
            self.node.set("PhysicalSizeY", str(value))

        PhysicalSizeY = property(get_PhysicalSizeY, set_PhysicalSizeY)

        def get_PhysicalSizeZ(self):
            """The dimensions of the image in the Z direction in physical units"""
            return get_float_attr(self.node, "PhysicalSizeZ")

        def set_PhysicalSizeZ(self, value):
            self.node.set("PhysicalSizeZ", str(value))

        PhysicalSizeZ = property(get_PhysicalSizeZ, set_PhysicalSizeZ)

        def get_channel_count(self):
            """The number of channels in the image

            You can change the number of channels in the image by
            setting the channel_count:

            pixels.channel_count = 3
            pixels.Channel(0).Name = "Red"
            ...
            """
            return len(self.node.findall(qn(self.ns['ome'], "Channel")))

        def set_channel_count(self, value):
            assert value >= 0
            channel_count = self.channel_count
            if channel_count > value:
                channels = self.node.findall(qn(self.ns['ome'], "Channel"))
                for channel in channels[value:]:
                    self.node.remove(channel)
            else:
                for _ in range(channel_count, value):
                    new_channel = OMEXML.Channel(
                        ElementTree.SubElement(self.node, qn(self.ns['ome'], "Channel")))
                    new_channel.ID = str(uuid.uuid4())
                    new_channel.Name = new_channel.ID
                    new_channel.SamplesPerPixel = 1

        channel_count = property(get_channel_count, set_channel_count)

        def Channel(self, index=0):
            """Get the indexed channel from the Pixels element"""
            channel = self.node.findall(qn(self.ns['ome'], "Channel"))[index]
            return OMEXML.Channel(channel)

        def get_plane_count(self):
            """The number of planes in the image

            An image with only one plane or an interleaved color plane will
            often not have any planes.

            You can change the number of planes in the image by
            setting the plane_count:

            pixels.plane_count = 3
            pixels.Plane(0).TheZ=pixels.Plane(0).TheC=pixels.Plane(0).TheT=0
            ...
            """
            return len(self.node.findall(qn(self.ns['ome'], "Plane")))

        def set_plane_count(self, value):
            assert value >= 0
            plane_count = self.plane_count
            if plane_count > value:
                planes = self.node.findall(qn(self.ns['ome'], "Plane"))
                for plane in planes[value:]:
                    self.node.remove(plane)
            else:
                for _ in range(plane_count, value):
                    # Create the necessary planes
                    OMEXML.Plane(ElementTree.SubElement(self.node, qn(self.ns['ome'], "Plane")))

        plane_count = property(get_plane_count, set_plane_count)

        def Plane(self, index=0):
            """Get the indexed plane from the Pixels element"""
            plane = self.node.findall(qn(self.ns['ome'], "Plane"))[index]
            return OMEXML.Plane(plane)

        def TiffData(self, index=0):
            """Get the indexed TiffData from the Pixels element"""
            tiffData = self.node.findall(qn(self.ns['ome'], "TiffData"))[index]
            return OMEXML.TiffData(tiffData)

        def get_planes_of_channel(self, index):
            planes = self.node.findall(qn(self.ns['ome'], "Plane[@TheC='"+str(index)+"']"))
            return planes

        # does not fix up any indices
        def remove_channel(self, index):
            channel = self.node.findall(qn(self.ns['ome'], "Channel"))[index]
            self.node.remove(channel)
            planes = self.get_planes_of_channel(index)
            for p in planes:
                self.node.remove(p)

        def append_channel(self, index, name):
            # add channel
            new_channel = OMEXML.Channel(
                ElementTree.SubElement(self.node, qn(self.ns['ome'], "Channel")))
            new_channel.SamplesPerPixel = 1
            new_channel.ID = "Channel:0:"+str(index)
            new_channel.Name = name
            # add a bunch of planes with "TheC"=str(index)
            for t in range(self.get_SizeT()):
                for z in range(self.get_SizeZ()):
                    new_plane = OMEXML.Plane(
                        ElementTree.SubElement(self.node, qn(self.ns['ome'], "Plane")))
                    new_plane.TheC = str(index)
                    new_plane.TheZ = str(z)
                    new_plane.TheT = str(t)
            # update SizeC
            self.set_SizeC(self.get_SizeC() + 1)

        # can be done as a single step just prior to final output
        def populate_TiffData(self):
            """ assuming Pixels has its sizes, set up tiffdata elements"""
            assert self.SizeC is not None
            assert self.SizeZ is not None
            assert self.SizeT is not None
            total = self.SizeC * self.SizeT * self.SizeZ
            # blow away the old ones.
            tiffdatas = self.node.findall(qn(self.ns['ome'], "TiffData"))
            for td in tiffdatas:
                self.node.remove(td)

            # assumes xyczt
            ifd = 0
            for i in range(self.SizeT):
                for j in range(self.SizeZ):
                    for k in range(self.SizeC):
                        new_tiffdata = OMEXML.TiffData(
                            ElementTree.SubElement(self.node, qn(self.ns['ome'], "TiffData")))
                        new_tiffdata.set_FirstC(k)
                        new_tiffdata.set_FirstZ(j)
                        new_tiffdata.set_FirstT(i)
                        new_tiffdata.set_IFD(ifd)
                        new_tiffdata.set_PlaneCount(1)
                        # child element <UUID FileName=""></UUID> is omitted here for single file ome tiffs
                        # UUID has an optional FileName attribute for image data that
                        # are split among several files but we do not currently support it.
                        # uuidelem = ElementTree.SubElement(new_tiffdata.node, qn(self.ns['ome'], "UUID"))
                        # uuidelem.text = self.ome_uuid
                        ifd = ifd + 1

    class StructuredAnnotations(dict):
        """The OME/StructuredAnnotations element

        Structured annotations let OME-XML represent metadata from other file
        formats, for example the tag metadata in TIFF files. The
        StructuredAnnotations element is a container for the structured
        annotations.

        Images can have structured annotation references. These match to
        the IDs of structured annotations in the StructuredAnnotations
        element. You can get the structured annotations in an OME-XML document
        using a dictionary interface to StructuredAnnotations.

        Pragmatically, TIFF tag metadata is stored as key/value pairs in
        OriginalMetadata annotations - in the context of CellProfiler,
        callers will be using these to read tag data that's not represented
        in OME-XML such as the bits per sample and min and max sample values.

        """

        def __init__(self, node):
            self.node = node
            self.ns = get_namespaces(self.node)

        def __getitem__(self, key):
            for child in self.node:
                if child.get("ID") == key:
                    return child
            raise IndexError('ID "%s" not found' % key)

        def __contains__(self, key):
            return self.has_key(key)

        def keys(self):
            return filter(lambda x: x is not None,
                          [child.get("ID") for child in self.node])

        def has_key(self, key):
            for child in self.node:
                if child.get("ID") == key:
                    return True
            return False

        def add_original_metadata(self, key, value):
            """Create an original data key/value pair

            key - the original metadata's key name, for instance OM_PHOTOMETRIC_INTERPRETATION

            value - the value, for instance, "RGB"

            returns the ID for the structured annotation.
            """
            xml_annotation = ElementTree.SubElement(
                self.node, qn(self.ns['sa'], "XMLAnnotation"))
            node_id = str(uuid.uuid4())
            xml_annotation.set("ID", node_id)
            xa_value = ElementTree.SubElement(xml_annotation, qn(self.ns['sa'], "Value"))
            ov = ElementTree.SubElement(
                xa_value, qn(NS_ORIGINAL_METADATA, "OriginalMetadata"))
            ov_key = ElementTree.SubElement(ov, qn(NS_ORIGINAL_METADATA, "Key"))
            set_text(ov_key, key)
            ov_value = ElementTree.SubElement(
                ov, qn(NS_ORIGINAL_METADATA, "Value"))
            set_text(ov_value, value)
            return node_id

        def iter_original_metadata(self):
            """An iterator over the original metadata in structured annotations

            returns (<annotation ID>, (<key, value>))

            where <annotation ID> is the ID attribute of the annotation (which
            can be used to tie an annotation to an image)

                  <key> is the original metadata key, typically one of the
                  OM_* names of a TIFF tag
                  <value> is the value for the metadata
            """
            #
            # Here's the XML we're traversing:
            #
            # <StructuredAnnotations>
            #    <XMLAnnotation>
            #        <Value>
            #            <OriginalMetadta>
            #                <Key>Foo</Key>
            #                <Value>Bar</Value>
            #            </OriginalMetadata>
            #        </Value>
            #    </XMLAnnotation>
            # </StructuredAnnotations>
            #
            for annotation_node in self.node.findall(qn(self.ns['sa'], "XMLAnnotation")):
                # <XMLAnnotation/>
                annotation_id = annotation_node.get("ID")
                for xa_value_node in annotation_node.findall(qn(self.ns['sa'], "Value")):
                    # <Value/>
                    for om_node in xa_value_node.findall(qn(NS_ORIGINAL_METADATA, "OriginalMetadata")):
                        # <OriginalMetadata>
                        key_node = om_node.find(qn(NS_ORIGINAL_METADATA, "Key"))
                        value_node = om_node.find(qn(NS_ORIGINAL_METADATA, "Value"))
                        if key_node is not None and value_node is not None:
                            key_text = get_text(key_node)
                            value_text = get_text(value_node)
                            if key_text is not None and value_text is not None:
                                yield annotation_id, (key_text, value_text)
                            else:
                                logger.warn("Original metadata was missing key or value:" + om_node.toxml())
            return

        def has_original_metadata(self, key):
            '''True if there is an original metadata item with the given key'''
            return any([k == key
                        for annotation_id, (k, v)
                        in self.iter_original_metadata()])

        def get_original_metadata_value(self, key, default=None):
            """Return the value for a particular original metadata key

            key - key to search for
            default - default value to return if not found
            """
            for annotation_id, (k, v) in self.iter_original_metadata():
                if k == key:
                    return v
            return default

        def get_original_metadata_refs(self, ids):
            """For a given ID, get the matching original metadata references

            ids - collection of IDs to match

            returns a dictionary of key to value
            """
            d = {}
            for annotation_id, (k, v) in self.iter_original_metadata():
                if annotation_id in ids:
                    d[k] = v
            return d

        @property
        def OriginalMetadata(self):
            return OMEXML.OriginalMetadata(self)

    class OriginalMetadata(dict):
        """View original metadata as a dictionary

        Original metadata holds "vendor-specific" metadata including TIFF
        tag values.
        """
        def __init__(self, sa):
            '''Initialized with the structured_annotations class instance'''
            self.sa = sa

        def __getitem__(self, key):
            return self.sa.get_original_metadata_value(key)

        def __setitem__(self, key, value):
            self.sa.add_original_metadata(key, value)

        def __contains__(self, key):
            return self.has_key(key)

        def __iter__(self):
            for annotation_id, (key, value) in self.sa.iter_original_metadata():
                yield key

        def __len__(self):
            return len(list(self.sa_iter_original_metadata()))

        def keys(self):
            return [key
                    for annotation_id, (key, value)
                    in self.sa.iter_original_metadata()]

        def has_key(self, key):
            for annotation_id, (k, value) in self.sa.iter_original_metadata():
                if k == key:
                    return True
            return False

        def iteritems(self):
            for annotation_id, (key, value) in self.sa.iter_original_metadata():
                yield key, value

    class PlatesDucktype(object):
        """It looks like a list of plates"""
        def __init__(self, root):
            self.root = root
            self.ns = get_namespaces(self.root)

        def __getitem__(self, key):
            plates = self.root.findall(qn(self.ns['spw'], "Plate"))
            if isinstance(key, slice):
                return [OMEXML.Plate(plate) for plate in plates[key]]
            return OMEXML.Plate(plates[key])

        def __len__(self):
            return len(self.root.findall(qn(self.ns['spw'], "Plate")))

        def __iter__(self):
            for plate in self.root.iterfind(qn(self.ns['spw'], "Plate")):
                yield OMEXML.Plate(plate)

        def newPlate(self, name, plate_id=str(uuid.uuid4())):
            new_plate_node = ElementTree.SubElement(
                self.root, qn(self.ns['spw'], "Plate"))
            new_plate = OMEXML.Plate(new_plate_node)
            new_plate.ID = plate_id
            new_plate.Name = name
            return new_plate

    class Plate(object):
        """The SPW:Plate element

        This represents the plate element of the SPW schema:
        http://www.openmicroscopy.org/Schemas/SPW/2007-06/
        """
        def __init__(self, node):
            self.node = node
            self.ns = get_namespaces(self.node)

        def get_ID(self):
            return self.node.get("ID")

        def set_ID(self, value):
            self.node.set("ID", value)

        ID = property(get_ID, set_ID)

        def get_Name(self):
            return self.node.get("Name")

        def set_Name(self, value):
            self.node.set("Name", value)

        Name = property(get_Name, set_Name)

        def get_Status(self):
            return self.node.get("Status")

        def set_Status(self, value):
            self.node.set("Status", value)

        Status = property(get_Status, set_Status)

        def get_ExternalIdentifier(self):
            return self.node.get("ExternalIdentifier")

        def set_ExternalIdentifier(self, value):
            return self.node.set("ExternalIdentifier", value)

        ExternalIdentifier = property(get_ExternalIdentifier, set_ExternalIdentifier)

        def get_ColumnNamingConvention(self):
            # Consider a default if not defined of NC_NUMBER
            return self.node.get("ColumnNamingConvention")

        def set_ColumnNamingConvention(self, value):
            assert value in (NC_LETTER, NC_NUMBER)
            self.node.set("ColumnNamingConvention", value)
        ColumnNamingConvention = property(get_ColumnNamingConvention,
                                          set_ColumnNamingConvention)

        def get_RowNamingConvention(self):
            # Consider a default if not defined of NC_LETTER
            return self.node.get("RowNamingConvention")

        def set_RowNamingConvention(self, value):
            assert value in (NC_LETTER, NC_NUMBER)
            self.node.set("RowNamingConvention", value)
        RowNamingConvention = property(get_RowNamingConvention,
                                       set_RowNamingConvention)

        def get_WellOriginX(self):
            return get_float_attr(self.node, "WellOriginX")

        def set_WellOriginX(self, value):
            self.node.set("WellOriginX", str(value))
        WellOriginX = property(get_WellOriginX, set_WellOriginX)

        def get_WellOriginY(self):
            return get_float_attr(self.node, "WellOriginY")

        def set_WellOriginY(self, value):
            self.node.set("WellOriginY", str(value))
        WellOriginY = property(get_WellOriginY, set_WellOriginY)

        def get_Rows(self):
            return get_int_attr(self.node, "Rows")

        def set_Rows(self, value):
            self.node.set("Rows", str(value))

        Rows = property(get_Rows, set_Rows)

        def get_Columns(self):
            return get_int_attr(self.node, "Columns")

        def set_Columns(self, value):
            self.node.set("Columns", str(value))

        Columns = property(get_Columns, set_Columns)

        def get_Description(self):
            description = self.node.find(qn(self.ns['spw'], "Description"))
            if description is None:
                return None
            return get_text(description)

        def set_Description(self, text):
            make_text_node(self.node, NS_SPW, "Description", test)
        Description = property(get_Description, set_Description)

        def get_Well(self):
            '''The well dictionary / list'''
            return OMEXML.WellsDucktype(self)
        Well = property(get_Well)

        def get_well_name(self, well):
            '''Get a well's name, using the row and column convention'''
            result = "".join([
                "%02d" % (i+1) if convention == NC_NUMBER
                else "ABCDEFGHIJKLMNOP"[i]
                for i, convention
                in ((well.Row, self.RowNamingConvention or NC_LETTER),
                    (well.Column, self.ColumnNamingConvention or NC_NUMBER))])
            return result

    class WellsDucktype(dict):
        """The WellsDucktype lets you retrieve and create wells

        The WellsDucktype looks like a dictionary but lets you reference
        the wells in a plate using indexing. Types of indexes:

        list indexing: e.g. plate.Well[14] gets the 14th well as it appears
                       in the XML
        dictionary_indexing:
            by well name - e.g. plate.Well["A08"]
            by row and column - e.g. plate.Well[1,3] (B03)
            by ID - e.g. plate.Well["Well:0:0:0"]
        If the ducktype is unable to parse a well name, it assumes you're
        using an ID.
        """
        def __init__(self, plate):
            self.plate_node = plate.node
            self.plate = plate
            self.ns = get_namespaces(self.plate_node)

        def __len__(self):
            return len(self.plate_node.findall(qn(self.ns['spw'], "Well")))

        def __getitem__(self, key):
            all_wells = self.plate_node.findall(qn(self.ns['spw'], "Well"))
            if isinstance(key, slice):
                return [OMEXML.Well(w) for w in all_wells[key]]
            if hasattr(key, "__len__") and len(key) == 2:
                well = OMEXML.Well(None)
                for w in all_wells:
                    well.node = w
                    if well.Row == key[0] and well.Column == key[1]:
                        return well
            if isinstance(key, int):
                return OMEXML.Well(all_wells[key])
            well = OMEXML.Well(None)
            for w in all_wells:
                well.node = w
                if self.plate.get_well_name(well) == key:
                    return well
                if well.ID == key:
                    return well
            return None

        def __iter__(self):
            """Return the standard name for all wells on the plate

            for instance, 'B03' for a well with Row=1, Column=2 for a plate
            with the standard row and column naming convention
            """
            all_wells = self.plate_node.findall(qn(self.ns['spw'], "Well"))
            well = OMEXML.Well(None)
            for w in all_wells:
                well.node = w
                yield self.plate.get_well_name(well)

        def new(self, row, column, well_id=str(uuid.uuid4())):
            """Create a new well at the given row and column

            row - index of well's row
            column - index of well's column
            well_id - the ID attribute for the well
            """
            well_node = ElementTree.SubElement(
                self.plate_node, qn(self.ns['spw'], "Well"))
            well = OMEXML.Well(well_node)
            well.Row = row
            well.Column = column
            well.ID = well_id
            return well

    class Well(object):
        def __init__(self, node):
            self.node = node

        def get_Column(self):
            return get_int_attr(self.node, "Column")

        def set_Column(self, value):
            self.node.set("Column", str(value))

        Column = property(get_Column, set_Column)

        def get_Row(self):
            return get_int_attr(self.node, "Row")

        def set_Row(self, value):
            self.node.set("Row", str(value))

        Row = property(get_Row, set_Row)

        def get_ID(self):
            return self.node.get("ID")

        def set_ID(self, value):
            self.node.set("ID", value)

        ID = property(get_ID, set_ID)

        def get_Sample(self):
            return OMEXML.WellSampleDucktype(self.node)

        Sample = property(get_Sample)

        def get_ExternalDescription(self):
            return self.node.get("ExternalDescription")

        def set_ExternalDescription(self, value):
            return self.node.set("ExternalDescription", value)

        ExternalDescription = property(get_ExternalDescription, set_ExternalDescription)

        def get_ExternalIdentifier(self):
            return self.node.get("ExternalIdentifier")

        def set_ExternalIdentifier(self, value):
            return self.node.set("ExternalIdentifier", value)

        ExternalIdentifier = property(get_ExternalIdentifier, set_ExternalIdentifier)

        def get_Color(self):
            return int(self.node.get("Color"))

        def set_Color(self, value):
            self.node.set("Color", str(value))

    class WellSampleDucktype(list):
        """The WellSample elements in a well

        This is made to look like an indexable list so that you can do
        things like:
        wellsamples[0:2]
        """
        def __init__(self, well_node):
            self.well_node = well_node
            self.ns = get_namespaces(self.well_node)

        def __len__(self):
            return len(self.well_node.findall(qn(self.ns['spw'], "WellSample")))

        def __getitem__(self, key):
            all_samples = self.well_node.findall(qn(self.ns['spw'], "WellSample"))
            if isinstance(key, slice):
                return [OMEXML.WellSample(s)
                        for s in all_samples[key]]
            return OMEXML.WellSample(all_samples[int(key)])

        def __iter__(self):
            """Iterate through the well samples."""
            all_samples = self.well_node.findall(qn(self.ns['spw'], "WellSample"))
            for s in all_samples:
                yield OMEXML.WellSample(s)

        def new(self, wellsample_id=str(uuid.uuid4()), index=None):
            """Create a new well sample"""
            if index is None:
                index = reduce(max, [s.Index for s in self], -1) + 1
            new_node = ElementTree.SubElement(
                self.well_node, qn(self.ns['spw'], "WellSample"))
            s = OMEXML.WellSample(new_node)
            s.ID = wellsample_id
            s.Index = index

    class WellSample(object):
        """The WellSample is a location within a well"""
        def __init__(self, node):
            self.node = node
            self.ns = get_namespaces(self.node)

        def get_ID(self):
            return self.node.get("ID")

        def set_ID(self, value):
            self.node.set("ID", value)
        ID = property(get_ID, set_ID)

        def get_PositionX(self):
            return get_float_attr(self.node, "PositionX")

        def set_PositionX(self, value):
            self.node.set("PositionX", str(value))

        PositionX = property(get_PositionX, set_PositionX)

        def get_PositionY(self):
            return get_float_attr(self.node, "PositionY")

        def set_PositionY(self, value):
            self.node.set("PositionY", str(value))

        PositionY = property(get_PositionY, set_PositionY)

        def get_Timepoint(self):
            return self.node.get("Timepoint")

        def set_Timepoint(self, value):
            if isinstance(value, datetime.datetime):
                value = value.isoformat()
            self.node.set("Timepoint", value)

        Timepoint = property(get_Timepoint, set_Timepoint)

        def get_Index(self):
            return get_int_attr(self.node, "Index")

        def set_Index(self, value):
            self.node.set("Index", str(value))

        Index = property(get_Index, set_Index)

        def get_ImageRef(self):
            '''Get the ID of the image of this site'''
            ref = self.node.find(qn(self.ns['spw'], "ImageRef"))
            if ref is None:
                return None
            return ref.get("ID")

        def set_ImageRef(self, value):
            '''Add a reference to the image of this site'''
            ref = self.node.find(qn(self.ns['spw'], "ImageRef"))
            if ref is None:
                ref = ElementTree.SubElement(self.node, qn(self.ns['spw'], "ImageRef"))
            ref.set("ID", value)

        ImageRef = property(get_ImageRef, set_ImageRef)
