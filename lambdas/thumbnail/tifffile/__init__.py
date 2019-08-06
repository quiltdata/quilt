from .tifffile import imsave, imread, imshow, TiffFile, TiffWriter, TiffSequence, FileHandle, lazyattr, natural_sorted, decode_lzw, stripnull, memmap, stripnull, format_size, squeeze_axes, create_output, repeat_nd, product

__version__ = '0.15.1'
__all__ = (
    'imsave', 'imread', 'imshow', 'TiffFile', 'TiffWriter', 'TiffSequence',
    # utility functions used in oiffile and czifile
    'FileHandle', 'lazyattr', 'natural_sorted', 'decode_lzw', 'stripnull',
    'memmap', 'stripnull', 'format_size', 'squeeze_axes', 'create_output', 'repeat_nd', 'product'
)

