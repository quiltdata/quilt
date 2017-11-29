# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Middleware: handling gzip encoding, etc.
"""

import gzip
import zlib

from werkzeug.exceptions import BadRequest
from werkzeug.wsgi import get_input_stream

class RequestEncodingMiddleware(object):
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        encoding = environ.pop('HTTP_CONTENT_ENCODING', 'identity')
        if encoding == 'gzip':
            environ['wsgi.input'] = gzip.GzipFile(fileobj=get_input_stream(environ), mode='rb')
            # Content length is no longer correct after unzipping.
            environ.pop('CONTENT_LENGTH', None)
            # HACK: Force werkzeug to read the stream without the content length.
            environ['wsgi.input_terminated'] = True
        elif encoding != 'identity':
            error = "Unsupported content encoding: %r" % encoding
            return BadRequest(error)(environ, start_response)

        try:
            return self.app(environ, start_response)
        except (OSError, zlib.error) as ex:
            # gzip raises OSError on invalid input... blah.
            error = "Failed to decode input: %s" % ex
            return BadRequest(error)(environ, start_response)
