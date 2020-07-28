"""Provides admin-only functions for Quilt."""
from .session import get_registry_url, get_session


def create_role(name, arn):
    """
    Create a new role in your registry. Admins only.

    Required Parameters:
        name(string): name of role to create
        arn(string): ARN of IAM role to associate with the Quilt role you are creating
    """
    session = get_session()
    response = session.post(
        "{url}/api/roles".format(
            url=get_registry_url()
            ),
        json={
            'name': name,
            'arn': arn
        }
    )

    return response.json()


def edit_role(role_id, new_name=None, new_arn=None):
    """
    Edit an existing role in your registry. Admins only.

    Required parameters:
        role_id(string): ID of role you want to operate on.

    Optional paramters:
        new_name(string): new name for role
        new_arn(string): new ARN for IAM role attached to Quilt role
    """
    session = get_session()
    old_data = get_role(role_id)
    data = {}
    data['name'] = new_name or old_data['name']
    data['arn'] = new_arn or old_data['arn']

    response = session.put(
        "{url}/api/roles/{role_id}".format(
            url=get_registry_url(),
            role_id=role_id
            ),
        json=data
    )

    return response.json()


def delete_role(role_id):
    """
    Delete a role in your registry. Admins only.

    Required parameters:
        role_id(string): ID of role you want to delete.
    """
    session = get_session()
    session.delete(
        "{url}/api/roles/{role_id}".format(
            url=get_registry_url(),
            role_id=role_id
            )
        )


def get_role(role_id):
    """
    Get info on a role based on its ID. Admins only.

    Required parameters:
        role_id(string): ID of role you want to get details on.
    """
    session = get_session()
    response = session.get(
        "{url}/api/roles/{role_id}".format(
            url=get_registry_url(),
            role_id=role_id
            )
        )

    return response.json()


def list_roles():
    """
    List configured roles. Admins only.
    """
    session = get_session()
    response = session.get(
        "{url}/api/roles".format(
            url=get_registry_url()
        ))

    return response.json()['results']


def set_role(username, role_name=''):
    """
    Set which role is associated with a user.
    Admins only.
    """
    session = get_session()
    data = {
        'username': username,
        'role': role_name
    }
    session.post(
        "{url}/api/users/set_role".format(
            url=get_registry_url()
        ),
        json=data
    )
