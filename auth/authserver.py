#!/usr/bin/env python3

from flask import abort, Flask, request
from flask_json import FlaskJSON, as_json

import requests

app = Flask(__name__)
FlaskJSON(app)

@app.route('/api-root')
@as_json
def api_root():
    auth = request.headers.get('Authorization', '')
    try:
        auth_type, auth_value = auth.split(' ')
    except ValueError:
        abort(requests.codes.forbidden)

    if auth_type != 'Bearer':
        abort(requests.codes.forbidden)

    return dict(
        current_user=auth_value
    )

if __name__ == '__main__':
    app.run('', 5002)
