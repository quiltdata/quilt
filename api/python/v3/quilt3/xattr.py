"""
Wraps `xattr` and adds a basic Windows implementation.
"""

import platform

if platform.system() != 'Windows':
    from xattr import getxattr, setxattr, removexattr
else:
    import os

    def _get_stream_path(filename, stream):
        # Because Windows is awesome:
        # https://docs.microsoft.com/en-us/windows/desktop/fileio/file-streams#naming-conventions-for-streams
        if len(str(filename)) == 1:
            filename = '.\\%s' % filename

        return '%s:%s' % (filename, stream)

    def getxattr(filename, name, symlink=False):
        with open(_get_stream_path(filename, name), 'rb') as fd:
            return fd.read()

    def setxattr(filename, name, value, options=0, symlink=False):
        with open(_get_stream_path(filename, name), 'wb') as fd:
            fd.write(value)

    def removexattr(filename, name, symlink=False):
        os.remove(_get_stream_path(filename, name))
