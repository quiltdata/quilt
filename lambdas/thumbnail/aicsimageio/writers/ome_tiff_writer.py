from __future__ import print_function

import os

import numpy as np
import tifffile

from aicsimageio.vendor import omexml

BYTE_BOUNDARY = 2 ** 21

# This is the threshold to use BigTiff, if it's the 4GB boundary it should be 2**22 but
# the libtiff writer was unable to handle a 2GB numpy array. It would be great if we better
# understood exactly what this threshold is and how to calculate it but for now this is a
# stopgap working value


class OmeTiffWriter:
    """This class can take arrays of pixel values and do the necessary metadata creation to write them
    properly in OME xml format.

    Example:
        image = numpy.ndarray([1, 10, 3, 1024, 2048])
        # There needs to be some sort of data inside the image array
        writer = ome_tiff_writer.OmeTiffWriter("file.ome.tif")
        writer.save(image)

        image2 = numpy.ndarray([5, 486, 210])
        # There needs to be some sort of data inside the image2 array
        with ome_tiff_writer.OmeTiffWriter("file2.ome.tif") as writer2:
            writer2.save(image2)

        # Convert a CZI file into OME Tif.
        reader = cziReader.CziReader("file3.czi")
        writer = ome_tiff_writer.OmeTiffWriter("file3.ome.tif")
        writer.save(reader.load())

    """

    def __init__(self, file_path, overwrite_file=None):
        """
        Class initializer
        :param file_path: path to image output location
        :param overwrite_file: flag to overwrite image or pass over image if it already exists
            None : (default) throw IOError if file exists
            True : overwrite existing file if file exists
            False: silently perform no write actions if file exists
        """
        self.file_path = file_path
        self.omeMetadata = omexml.OMEXML()
        self.silent_pass = False
        if os.path.isfile(self.file_path):
            if overwrite_file:
                os.remove(self.file_path)
            elif overwrite_file is None:
                raise IOError("File {} exists but user has chosen not to overwrite it".format(self.file_path))
            elif overwrite_file is False:
                self.silent_pass = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def close(self):
        pass

    def save(self, data, ome_xml=None, channel_names=None, image_name="IMAGE0", pixels_physical_size=None,
             channel_colors=None):
        """
        Save an image with the proper OME xml metadata.

        Parameters
        ----------
        data: An array of dimensions TZCYX, ZCYX, or ZYX to be written out to a file.
        ome_xml:
        channel_names: The names for each channel to be put into the OME metadata
        image_name: The name of the image to be put into the OME metadata
        pixels_physical_size: The physical size of each pixel in the image
        channel_colors: The channel colors to be put into the OME metadata

        Returns
        -------

        """
        if self.silent_pass:
            return

        tif = tifffile.TiffWriter(self.file_path, bigtiff=self._size_of_ndarray(data=data) > BYTE_BOUNDARY)

        shape = data.shape
        assert (len(shape) == 5 or len(shape) == 4 or len(shape) == 3)

        # if this is 3d data, then assume it's ZYX and transform it to the expected TZCYX
        if len(shape) == 3:
            data = np.expand_dims(data, axis=1)
            data = np.expand_dims(data, axis=0)
        # if this is 4d data, then assume it's ZCYX and transform it to the expected TZCYX
        elif len(shape) == 4:
            data = np.expand_dims(data, axis=0)

        if ome_xml is None:
            self._make_meta(data, channel_names=channel_names, image_name=image_name,
                            pixels_physical_size=pixels_physical_size, channel_colors=channel_colors)
        else:
            pixels = ome_xml.image().Pixels
            pixels.populate_TiffData()
            self.omeMetadata = ome_xml
        xml = self.omeMetadata.to_xml().encode()

        # check data shape for TZCYX or ZCYX or ZYX
        dims = len(shape)
        if dims == 5 or dims == 4 or dims == 3:
            # minisblack instructs TiffWriter to not try to infer rgb color within the data array
            # metadata param fixes the double image description bug
            tif.save(data, compress=9, description=xml, photometric='minisblack', metadata=None)

        tif.close()

    def save_slice(self, data, z=0, c=0, t=0):
        """ this doesn't do the necessary functionality at this point

        TODO:
            * make this insert a YX slice in between two other slices inside a full image
            * data should be a 5 dim array

        :param data:
        :param z:
        :param c:
        :param t:
        :return:
        """
        if self.silent_pass:
            return

        assert len(data.shape) == 2
        assert data.shape[0] == self.size_y()
        assert data.shape[1] == self.size_x()
        tif = tifffile.TiffWriter(self.file_path)
        tif.save(data, compress=9)
        tif.close()

    def set_metadata(self, ome_metadata):
        self.omeMetadata = ome_metadata

    def size_z(self):
        return self.omeMetadata.image().Pixels.SizeZ

    def size_c(self):
        return self.omeMetadata.image().Pixels.SizeC

    def size_t(self):
        return self.omeMetadata.image().Pixels.SizeT

    def size_x(self):
        return self.omeMetadata.image().Pixels.SizeX

    def size_y(self):
        return self.omeMetadata.image().Pixels.SizeY

    @staticmethod
    def _size_of_ndarray(data: np.ndarray) -> int:
        """
        Calculate the size of data to determine if we require bigtiff
        Returns
        -------
        the size of data in bytes
        """
        if data is None:
            return 0
        size = data.size * data.itemsize
        return size

    # set up some sensible defaults from provided info
    def _make_meta(self, data, channel_names=None, image_name="IMAGE0", pixels_physical_size=None, channel_colors=None):
        """Creates the necessary metadata for an OME tiff image

        :param data: An array of dimensions TZCYX, ZCYX, or ZYX to be written out to a file.
        :param channel_names: The names for each channel to be put into the OME metadata
        :param image_name: The name of the image to be put into the OME metadata
        :param pixels_physical_size: The physical size of each pixel in the image
        :param channel_colors: The channel colors to be put into the OME metadata
        """
        ox = self.omeMetadata

        ox.image().set_Name(image_name)
        ox.image().set_ID("0")
        pixels = ox.image().Pixels
        pixels.ome_uuid = ox.uuidStr
        pixels.set_ID("0")
        if pixels_physical_size is not None:
            pixels.set_PhysicalSizeX(pixels_physical_size[0])
            pixels.set_PhysicalSizeY(pixels_physical_size[1])
            pixels.set_PhysicalSizeZ(pixels_physical_size[2])
        shape = data.shape
        if len(shape) == 5:
            pixels.channel_count = shape[2]
            pixels.set_SizeT(shape[0])
            pixels.set_SizeZ(shape[1])
            pixels.set_SizeC(shape[2])
            pixels.set_SizeY(shape[3])
            pixels.set_SizeX(shape[4])
        elif len(shape) == 4:
            pixels.channel_count = shape[1]
            pixels.set_SizeT(1)
            pixels.set_SizeZ(shape[0])
            pixels.set_SizeC(shape[1])
            pixels.set_SizeY(shape[2])
            pixels.set_SizeX(shape[3])
        elif len(shape) == 3:
            pixels.channel_count = 1
            pixels.set_SizeT(1)
            pixels.set_SizeZ(shape[0])
            pixels.set_SizeC(1)
            pixels.set_SizeY(shape[1])
            pixels.set_SizeX(shape[2])

        # this must be set to the *reverse* of what dimensionality the ome tif file is saved as
        pixels.set_DimensionOrder('XYCZT')

        # convert our numpy dtype to a ome compatible pixeltype
        pixels.set_PixelType(omexml.get_pixel_type(data.dtype))

        if channel_names is None:
            for i in range(pixels.SizeC):
                pixels.Channel(i).set_ID("Channel:0:" + str(i))
                pixels.Channel(i).set_Name("C:" + str(i))
        else:
            for i in range(pixels.SizeC):
                name = channel_names[i]
                pixels.Channel(i).set_ID("Channel:0:" + str(i))
                pixels.Channel(i).set_Name(name)

        if channel_colors is not None:
            assert len(channel_colors) >= pixels.get_SizeC()
            for i in range(pixels.SizeC):
                pixels.Channel(i).set_Color(channel_colors[i])

        # assume 1 sample per channel
        for i in range(pixels.SizeC):
            pixels.Channel(i).set_SamplesPerPixel(1)

        # many assumptions in here: one file per image, one plane per tiffdata, etc.
        pixels.populate_TiffData()

        return ox
