"""
GraphQL schema validation helpers for admin operations.

Provides utilities to validate that GraphQL responses match expected schema structures
and contain required fields for proper operation.
"""

from typing import Any, Dict, List, Optional, Union


def validate_user_response(response_data: Dict[str, Any]) -> bool:
    """Validate user response matches expected schema.

    Args:
        response_data: User response data to validate (can be either raw GraphQL or dataclass dict)

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(response_data, dict):
        return False

    # Handle both GraphQL camelCase and dataclass snake_case field names
    graphql_fields = {
        'name': str,
        'email': str,
        'dateJoined': object,  # datetime object
        'lastLogin': object,   # datetime object
        'isActive': bool,
        'isAdmin': bool,
        'isSsoOnly': bool,
        'isService': bool,
        'role': (dict, type(None)),  # Can be dict or None
        'extraRoles': list,
    }

    dataclass_fields = {
        'name': str,
        'email': str,
        'date_joined': object,  # datetime object
        'last_login': object,   # datetime object
        'is_active': bool,
        'is_admin': bool,
        'is_sso_only': bool,
        'is_service': bool,
        'role': (dict, type(None), object),  # Can be dict, None, or role object
        'extra_roles': list,
    }

    # Determine which field format we're dealing with
    if 'dateJoined' in response_data:
        required_fields = graphql_fields
        role_field = 'role'
        extra_roles_field = 'extraRoles'
    elif 'date_joined' in response_data:
        required_fields = dataclass_fields
        role_field = 'role'
        extra_roles_field = 'extra_roles'
    else:
        return False

    # Check all required fields are present and have correct types
    for field, expected_type in required_fields.items():
        if field not in response_data:
            return False
        if isinstance(expected_type, tuple):
            if not any(isinstance(response_data[field], t) for t in expected_type):
                return False
        else:
            if not isinstance(response_data[field], expected_type):
                return False

    # Validate role structure (if not None)
    if response_data[role_field] is not None:
        role_data = response_data[role_field]
        if hasattr(role_data, '__dict__'):
            # It's a dataclass object, convert to dict
            role_data = role_data.__dict__
        if not validate_role_response(role_data):
            return False

    # Validate extra roles
    for role in response_data[extra_roles_field]:
        role_data = role
        if hasattr(role_data, '__dict__'):
            # It's a dataclass object, convert to dict
            role_data = role_data.__dict__
        if not validate_role_response(role_data):
            return False

    return True


def validate_role_response(response_data: Dict[str, Any]) -> bool:
    """Validate role response matches expected schema.

    Args:
        response_data: Role response data to validate (can be either raw GraphQL or dataclass dict)

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(response_data, dict):
        return False

    # Handle both GraphQL and dataclass field names
    if '__typename' in response_data:
        # GraphQL format
        required_fields = {
            '__typename': str,
            'id': str,
            'name': str,
            'arn': str,
        }
        typename_field = '__typename'
    elif 'typename__' in response_data:
        # Dataclass format
        required_fields = {
            'typename__': str,
            'id': str,
            'name': str,
            'arn': str,
        }
        typename_field = 'typename__'
    else:
        return False

    # Check all required fields are present and have correct types
    for field, expected_type in required_fields.items():
        if field not in response_data:
            return False
        if not isinstance(response_data[field], expected_type):
            return False

    # Validate typename is one of the expected role types
    valid_types = {'UnmanagedRole', 'ManagedRole'}
    if response_data[typename_field] not in valid_types:
        return False

    return True


def validate_sso_config_response(response_data: Dict[str, Any]) -> bool:
    """Validate SSO config response matches expected schema.

    Args:
        response_data: SSO config response data to validate (can be either raw GraphQL or dataclass dict)

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(response_data, dict):
        return False

    # Handle both GraphQL and dataclass field names
    if '__typename' in response_data:
        # GraphQL format
        required_fields = {
            '__typename': str,
            'text': str,
            'timestamp': object,  # datetime object
            'uploader': dict,
        }
        uploader_field = 'uploader'
    else:
        # Dataclass format (no __typename field)
        required_fields = {
            'text': str,
            'timestamp': object,  # datetime object
            'uploader': object,  # Can be dict or User object
        }
        uploader_field = 'uploader'

    # Check all required fields are present and have correct types
    for field, expected_type in required_fields.items():
        if field not in response_data:
            return False
        if not isinstance(response_data[field], expected_type):
            return False

    # Validate uploader is a valid user
    uploader_data = response_data[uploader_field]
    if hasattr(uploader_data, '__dict__'):
        # It's a dataclass object, convert to dict
        uploader_data = uploader_data.__dict__
    if not validate_user_response(uploader_data):
        return False

    return True


def validate_tabulator_table_response(response_data: Dict[str, Any]) -> bool:
    """Validate tabulator table response matches expected schema.

    Args:
        response_data: Tabulator table response data to validate

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(response_data, dict):
        return False

    required_fields = {
        'name': str,
        'config': str,
    }

    # Check all required fields are present and have correct types
    for field, expected_type in required_fields.items():
        if field not in response_data:
            return False
        if not isinstance(response_data[field], expected_type):
            return False

    return True


def validate_error_response(response_data: Dict[str, Any]) -> bool:
    """Validate error response matches expected schema.

    Args:
        response_data: Error response data to validate

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(response_data, dict):
        return False

    typename = response_data.get('__typename')

    if typename == 'InvalidInput':
        return validate_invalid_input_error(response_data)
    elif typename == 'OperationError':
        return validate_operation_error(response_data)
    else:
        return False


def validate_invalid_input_error(response_data: Dict[str, Any]) -> bool:
    """Validate InvalidInput error response.

    Args:
        response_data: InvalidInput error response data to validate

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(response_data, dict):
        return False

    required_fields = {
        '__typename': str,
        'errors': list,
    }

    # Check all required fields are present and have correct types
    for field, expected_type in required_fields.items():
        if field not in response_data:
            return False
        if not isinstance(response_data[field], expected_type):
            return False

    # Validate each error in the errors list
    for error in response_data['errors']:
        if not isinstance(error, dict):
            return False

        error_fields = {
            'path': (str, list),  # Can be string or list
            'message': str,
            'name': str,
            'context': dict,
        }

        for field, expected_types in error_fields.items():
            if field not in error:
                return False
            if isinstance(expected_types, tuple):
                if not any(isinstance(error[field], t) for t in expected_types):
                    return False
            else:
                if not isinstance(error[field], expected_types):
                    return False

    return True


def validate_operation_error(response_data: Dict[str, Any]) -> bool:
    """Validate OperationError response.

    Args:
        response_data: OperationError response data to validate

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(response_data, dict):
        return False

    required_fields = {
        '__typename': str,
        'message': str,
        'name': str,
        'context': dict,
    }

    # Check all required fields are present and have correct types
    for field, expected_type in required_fields.items():
        if field not in response_data:
            return False
        if not isinstance(response_data[field], expected_type):
            return False

    return True


def validate_graphql_response_structure(response_data: Dict[str, Any], expected_path: str) -> bool:
    """Validate that a GraphQL response has the expected nested structure.

    Args:
        response_data: The full GraphQL response data
        expected_path: Dot-separated path to the expected data (e.g., "admin.user.list")

    Returns:
        True if the path exists in the response, False otherwise
    """
    current = response_data
    path_parts = expected_path.split('.')

    for part in path_parts:
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]

    return True


def extract_response_data(response_data: Dict[str, Any], path: str) -> Any:
    """Extract data from a GraphQL response using a dot-separated path.

    Args:
        response_data: The full GraphQL response data
        path: Dot-separated path to the data (e.g., "admin.user.list")

    Returns:
        The extracted data, or None if path doesn't exist
    """
    current = response_data
    path_parts = path.split('.')

    try:
        for part in path_parts:
            current = current[part]
        return current
    except (KeyError, TypeError):
        return None
