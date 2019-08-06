from . import types


class BufferReader:

    INTEL_ENDIAN = b'II'
    MOTOROLA_ENDIAN = b'MM'

    def __init__(self, buffer: types.FileLike):
        self.buffer = buffer
        self.previous_position = self.buffer.tell()
        self.description_length = 0
        self.description_offset = 0
        self.endianness = None

    def __enter__(self):
        self.buffer.seek(0)
        self.endianness = bytearray(self.buffer.read(2))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.reset()

    def reset(self):
        self.buffer.seek(self.previous_position)

    # All of these read_uint* routines obey the endianness, with 'II' being little-endian
    # and 'MM' being big-endian (per TIFF-6)
    def read_uint16(self):
        value = bytearray(self.buffer.read(2))
        return (value[0] + (value[1] << 8)) if self.endianness == self.INTEL_ENDIAN else (value[1] + (value[0] << 8))

    def read_uint32(self):
        value = bytearray(self.buffer.read(4))
        if self.endianness == self.INTEL_ENDIAN:
            return value[0] + (value[1] << 8) + (value[2] << 16) + (value[3] << 24)
        return value[3] + (value[2] << 8) + (value[1] << 16) + (value[0] << 24)

    def read_uint64(self):
        if self.endianness == self.INTEL_ENDIAN:
            return self.read_uint32() + (self.read_uint32() << 32)
        return (self.read_uint32() << 32) + self.read_uint32()

    def read_bytes(self, n_bytes: int):
        return bytearray(self.buffer.read(n_bytes))
