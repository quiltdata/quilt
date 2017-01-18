# Run the server.
import os
from quilt_server import app
debug = bool(os.environ.get('FLASK_DEBUG', False))
app.run(host='0.0.0.0', port=8080, debug=debug)

