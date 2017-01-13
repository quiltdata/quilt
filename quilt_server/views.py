"""
API routes.
"""

from flask import render_template, url_for
from flask_oauthlib.client import OAuth, OAuthException

from . import app


oauth = OAuth()
oauth.init_app(app)

quilt_auth = oauth.remote_app('quilt-auth', app_key='QUILT_AUTH')

@app.route('/login')
def login():
    return quilt_auth.authorize(
        callback=url_for('oauth_callback', _external=True))

@app.route('/oauth_callback')
def oauth_callback():
    try:
        resp = quilt_auth.authorized_response()
        if resp is None:
            return render_template('oauth_fail.html', error="You denied access!")

        return render_template('oauth_success.html', code=resp['refresh_token'])
    except OAuthException as ex:
        return render_template('oauth_fail.html', error=ex.message)
