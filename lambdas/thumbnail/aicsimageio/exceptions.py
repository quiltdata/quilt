

class UnsupportedFileFormatError(Exception):
    """
    This exception is intended to communicate that the file extension is not one of
    the supported file types and cannot be parsed with AICSImage.
    """

    def __init__(self, type_, **kwargs):
        super().__init__(**kwargs)
        self.type_ = type_

    def __str__(self):
        return f"AICSImage module does not support this image file type: '{self.type_}'"


class InvalidDimensionOrderingError(Exception):
    """
    A general exception that can be thrown when handling dimension ordering or validation. Should be provided a message
    for the user to be given more context.
    """

    def __init__(self, message: str, **kwargs):
        super().__init__(**kwargs)
        self.message = message

    def __str__(self):
        return self.message


class MultiSceneCziException(Exception):
    """
    This exception is intended to be thrown when a CZI file has multiple scenes. This is only to
    be thrown if the Reader is given a multi-scene CZI files and the backend library isn't able
    to read multi-scene CZI.
    """
    pass


class ConflictingArgumentsError(Exception):
    """
    This exception is returned when 2 arguments to the same function are in conflict.
    """
    pass
