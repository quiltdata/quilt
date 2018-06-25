#!/usr/bin/env python3

"""
Creates an admin account.
"""

import getpass
import sys

from quilt_server import ApiException, app
from quilt_server.auth import _activate_user, _create_user, validate_password
from quilt_server.models import User


def main(argv):
    if len(argv) > 1:
        print("Usage: %s" % argv[0], file=sys.stderr)
        return 1

    username = input("Username: ")
    email = input("Email: ")
    password1 = getpass.getpass("Password: ")
    try:
        validate_password(password1)
    except ApiException as ex:
        print("Error: %s" % ex.message, file=sys.stderr)
        return 2
    password2 = getpass.getpass("Confirm password: ")

    if password1 != password2:
        print("Passwords don't match!", file=sys.stderr)
        return 2

    try:
        with app.app_context():
            _create_user(username, password=password1, email=email,
                         is_admin=True, requires_activation=False)
            user = User.get_by_name(username)
            _activate_user(user)
    except ApiException as ex:
        print("Error: %s" % ex.message, file=sys.stderr)
        return 2

    print("Success.")
    return 0

sys.exit(main(sys.argv))
