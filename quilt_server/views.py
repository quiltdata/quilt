"""
API routes.
"""

from flask_json import as_json

from . import app

@app.route('/')
def index():
    return "Hello World"

@app.route('/api/test', methods=['POST'])
@as_json
def test():
    return dict(status='ok')
