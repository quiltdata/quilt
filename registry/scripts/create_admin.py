#!/usr/bin/env python3

"""
Creates an admin account.
"""

import argparse
import getpass
import os
import sys

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate, upgrade as _upgrade

from quilt_server import app, db
from quilt_server.auth import _create_user, validate_password, AuthException
from quilt_server.models import User

def main(argv):
    parser = argparse.ArgumentParser(description='Create an admin user account.')
    parser.add_argument('-e', '--env', dest='env', action='store_true',
                        help='Pass account info in environment variables.')
    args = parser.parse_args(argv)
    
    if args.env:
        username = os.environ.get("QUILT_ADMIN_USERNAME")
        email = os.environ.get("QUILT_ADMIN_EMAIL")
        password1 = os.environ.get("QUILT_ADMIN_PASSWORD")
        if not (username and email and password1):
            print("Error: set environment variables not set.")
        validate_password(password1)
    else:
        username = input("Username: ")
        email = input("Email: ")
        password1 = getpass.getpass("Password: ")
        try:
            validate_password(password1)
        except AuthException as ex:
            print("Error: %s" % ex.message, file=sys.stderr)
            return 2
        password2 = getpass.getpass("Confirm password: ")

        if password1 != password2:
            print("Passwords don't match!", file=sys.stderr)
            return 2

    try:
        with app.app_context():
            migrate = Migrate(app, db)
            # apply any/all pending migrations.
            _upgrade()
            
            _create_user(username, password=password1, email=email,
                         is_admin=True, requires_activation=False)
            db.session.commit()
    except AuthException as ex:
        print("Error: %s" % ex.message, file=sys.stderr)
        return 2

    print("Success.")
    return 0

if __name__ == "__main__":
  main(sys.argv[1:])
