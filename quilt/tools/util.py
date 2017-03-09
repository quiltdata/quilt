"""
Helper functions.
"""

import os

from appdirs import user_data_dir
from tqdm import tqdm

APP_NAME = "QuiltCli"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)


class FileWithReadProgress(object):
    """
    Acts like a file with mode='rb', but displays a progress bar while the file is read.
    """
    def __init__(self, path):
        self._fd = open(path, 'rb')
        self._progress = tqdm(
            total=os.path.getsize(path),
            unit='B',
            unit_scale=True
        )

    def read(self, size=-1):
        """Read bytes and update the progress bar."""
        buf = self._fd.read(size)
        self._progress.update(len(buf))
        return buf

    def close(self):
        """Close the file and the progress bar."""
        self._progress.close()
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
    with open(fname, 'rU') as f:
        data = f.read()
    return data
