"""
Helper functions.
"""

import gzip

from appdirs import user_data_dir
from six import BytesIO, string_types, Iterator

APP_NAME = "QuiltCli"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)


class FileWithReadProgress(Iterator):
    """
    Acts like a file with mode='rb', but displays a progress bar while the file is read.
    """
    def __init__(self, path_or_fd, progress_cb):
        if isinstance(path_or_fd, string_types):
            self._fd = open(path_or_fd, 'rb')
            self._need_to_close = True
        else:
            self._fd = path_or_fd
            self._need_to_close = False

        self._progress_cb = progress_cb

    def read(self, size=-1):
        """Read bytes and update the progress bar."""
        buf = self._fd.read(size)
        self._progress_cb(len(buf))
        return buf

    def __iter__(self):
        return self

    def __next__(self):
        """Read the next line and update the progress bar."""
        buf = next(self._fd)
        self._progress_cb(len(buf))
        return buf

    def tell(self):
        """Get the file position."""
        return self._fd.tell()

    def seek(self, offset, whence=0):
        """Set the new file position."""
        self._fd.seek(offset, whence)

    def close(self):
        """Close the file."""
        if self._need_to_close:
            self._fd.close()

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        self.close()


def file_to_str(fname):
    """
    Read a file into a string
    PRE: fname is a small file (to avoid hogging memory and its discontents)
    """
    data = None
    # rU = read with Universal line terminator
    with open(fname, 'rU') as fd:
        data = fd.read()
    return data

def gzip_compress(data):
    """
    Compress a string. Same as gzip.compress in Python3.
    """
    buf = BytesIO()
    with gzip.GzipFile(fileobj=buf, mode='wb') as fd:
        fd.write(data)
    return buf.getvalue()
