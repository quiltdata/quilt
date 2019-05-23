#!/usr/bin/env python3

import argparse
from base64 import b64decode
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys
from urllib.parse import urlparse, parse_qsl, unquote

from index import lambda_handler


PORT = 8080
LAMBDA_PATH = '/lambda'

class Handler(BaseHTTPRequestHandler):
    def _handle_request(self, req_body):
        parsed_url = urlparse(self.path)
        path = unquote(parsed_url.path)

        if path == LAMBDA_PATH:
            query = dict(parse_qsl(parsed_url.query))
            # BaseHTTPRequestHandler API gives us a case-insensitive dict
            # of headers, while the lambda API uses lowercase header names.
            # So change the keys to lowercase to match the lambda API.
            headers = {k.lower(): v for k, v in self.headers.items()}

            args = {
                'httpMethod': self.command,
                'path': path,
                'queryStringParameters': query or None,
                'headers': headers or None,
                'body': req_body,
            }

            result = lambda_handler(args, None)

            code = result['statusCode']
            headers = result['headers']
            body = result['body']
            encoded = result.get("isBase64Encoded", False)

            if encoded:
                body = b64decode(body)
            else:
                body = body.encode()

            headers['Content-Length'] = str(len(body))

            self.send_response(code)
            for name, value in headers.items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Not Found')

    def do_GET(self):
        self._handle_request(None)

    def do_POST(self):
        size = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(size)
        self._handle_request(body)


def main(argv):
    if len(argv) != 1:
        print('Usage: %s', file=sys.stderr)
        return 1

    server_address = ('127.0.0.1', PORT)
    print("Running on http://%s:%d%s" % (server_address[0], server_address[1], LAMBDA_PATH))
    server = HTTPServer(server_address, Handler)
    server.serve_forever()


if __name__ == '__main__':
    sys.exit(main(sys.argv))
