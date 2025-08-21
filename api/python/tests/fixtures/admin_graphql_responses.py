"""
GraphQL response fixtures for admin operations.

Contains comprehensive mock responses for all admin GraphQL operations,
including success cases, validation errors, and other error scenarios.
"""

import datetime


# Base fixture data
UNMANAGED_ROLE = {
    "__typename": "UnmanagedRole",
    "id": "d7d15bef-c482-4086-ae6b-d0372b6145d2",
    "name": "UnmanagedRole",
    "arn": "arn:aws:iam::000000000000:role/UnmanagedRole",
}

MANAGED_ROLE = {
    "__typename": "ManagedRole",
    "id": "b1bab604-98fd-4b46-a20b-958cf2541c91",
    "name": "ManagedRole",
    "arn": "arn:aws:iam::000000000000:role/ManagedRole",
}

USER = {
    "__typename": "User",
    "name": "test",
    "email": "test@example.com",
    "dateJoined": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "lastLogin": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "isActive": True,
    "isAdmin": False,
    "isSsoOnly": False,
    "isService": False,
    "role": UNMANAGED_ROLE,
    "extraRoles": [MANAGED_ROLE],
}

SSO_CONFIG = {
    "__typename": "SsoConfig",
    "text": "",
    "timestamp": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "uploader": USER,
}

TABULATOR_TABLE = {
    "name": "table",
    "config": "config",
}

# Role operation responses
ROLES_LIST_RESPONSE = {
    "roles": [UNMANAGED_ROLE, MANAGED_ROLE]
}

# User operation responses
USERS_LIST_RESPONSE = {
    "admin": {
        "user": {
            "list": [USER]
        }
    }
}

USERS_GET_RESPONSE = {
    "admin": {
        "user": {
            "get": USER
        }
    }
}

USERS_GET_NOT_FOUND_RESPONSE = {
    "admin": {
        "user": {
            "get": None
        }
    }
}

USERS_CREATE_SUCCESS_RESPONSE = {
    "admin": {
        "user": {
            "create": USER
        }
    }
}

def user_mutation_success_response(mutation_name: str) -> dict:
    """Generate a success response for a user mutation.
    
    Args:
        mutation_name: The mutation name (e.g., "setEmail", "setAdmin")
    
    Returns:
        Success response dict
    """
    return {
        "admin": {
            "user": {
                "mutate": {
                    mutation_name: USER
                }
            }
        }
    }

# Individual mutation responses
USERS_SET_EMAIL_SUCCESS_RESPONSE = user_mutation_success_response("setEmail")
USERS_SET_ADMIN_SUCCESS_RESPONSE = user_mutation_success_response("setAdmin") 
USERS_SET_ACTIVE_SUCCESS_RESPONSE = user_mutation_success_response("setActive")
USERS_SET_ROLE_SUCCESS_RESPONSE = user_mutation_success_response("setRole")
USERS_ADD_ROLES_SUCCESS_RESPONSE = user_mutation_success_response("addRoles")
USERS_REMOVE_ROLES_SUCCESS_RESPONSE = user_mutation_success_response("removeRoles")

USER_MUTATION_NOT_FOUND_RESPONSE = {
    "admin": {
        "user": {
            "mutate": None
        }
    }
}

# SSO configuration responses
SSO_CONFIG_GET_RESPONSE = {
    "admin": {
        "ssoConfig": SSO_CONFIG
    }
}

SSO_CONFIG_GET_NOT_FOUND_RESPONSE = {
    "admin": {
        "ssoConfig": None
    }
}

SSO_CONFIG_SET_SUCCESS_RESPONSE = {
    "admin": {
        "setSsoConfig": SSO_CONFIG
    }
}

SSO_CONFIG_SET_NULL_RESPONSE = {
    "admin": {
        "setSsoConfig": None
    }
}

# Tabulator operation responses
TABULATOR_TABLES_LIST_RESPONSE = {
    "bucketConfig": {
        "tabulatorTables": [TABULATOR_TABLE]
    }
}

TABULATOR_TABLES_BUCKET_NOT_FOUND_RESPONSE = {
    "bucketConfig": None
}

TABULATOR_TABLE_SET_SUCCESS_RESPONSE = {
    "admin": {
        "bucketSetTabulatorTable": {
            "__typename": "BucketConfig"
        }
    }
}

TABULATOR_TABLE_RENAME_SUCCESS_RESPONSE = {
    "admin": {
        "bucketRenameTabulatorTable": {
            "__typename": "BucketConfig"
        }
    }
}

TABULATOR_GET_OPEN_QUERY_RESPONSE = {
    "admin": {
        "tabulatorOpenQuery": True
    }
}

TABULATOR_SET_OPEN_QUERY_RESPONSE = {
    "admin": {
        "setTabulatorOpenQuery": {
            "tabulatorOpenQuery": True
        }
    }
}

# Error responses
INVALID_INPUT_ERROR = {
    "__typename": "InvalidInput",
    "errors": [
        {
            "path": "email",
            "message": "Invalid email format",
            "name": "ValidationError",
            "context": {},
        }
    ],
}

OPERATION_ERROR = {
    "__typename": "OperationError",
    "message": "Operation failed",
    "name": "OperationError",
    "context": {},
}

# Error response templates
USERS_CREATE_VALIDATION_ERROR_RESPONSE = {
    "admin": {
        "user": {
            "create": INVALID_INPUT_ERROR
        }
    }
}

USERS_CREATE_OPERATION_ERROR_RESPONSE = {
    "admin": {
        "user": {
            "create": OPERATION_ERROR
        }
    }
}

USER_DELETE_VALIDATION_ERROR_RESPONSE = {
    "admin": {
        "user": {
            "mutate": {
                "delete": INVALID_INPUT_ERROR
            }
        }
    }
}

USER_DELETE_OPERATION_ERROR_RESPONSE = {
    "admin": {
        "user": {
            "mutate": {
                "delete": OPERATION_ERROR
            }
        }
    }
}

SSO_CONFIG_SET_VALIDATION_ERROR_RESPONSE = {
    "admin": {
        "setSsoConfig": INVALID_INPUT_ERROR
    }
}

SSO_CONFIG_SET_OPERATION_ERROR_RESPONSE = {
    "admin": {
        "setSsoConfig": OPERATION_ERROR
    }
}

TABULATOR_SET_VALIDATION_ERROR_RESPONSE = {
    "admin": {
        "bucketSetTabulatorTable": INVALID_INPUT_ERROR
    }
}

TABULATOR_SET_OPERATION_ERROR_RESPONSE = {
    "admin": {
        "bucketSetTabulatorTable": OPERATION_ERROR
    }
}

TABULATOR_RENAME_VALIDATION_ERROR_RESPONSE = {
    "admin": {
        "bucketRenameTabulatorTable": INVALID_INPUT_ERROR
    }
}

TABULATOR_RENAME_OPERATION_ERROR_RESPONSE = {
    "admin": {
        "bucketRenameTabulatorTable": OPERATION_ERROR
    }
}

# Helper functions for generating user mutation error responses
def user_mutation_validation_error_response(mutation_name: str) -> dict:
    """Generate a validation error response for a user mutation.
    
    Args:
        mutation_name: The mutation name (e.g., "setEmail", "setAdmin")
    
    Returns:
        Error response dict
    """
    return {
        "admin": {
            "user": {
                "mutate": {
                    mutation_name: INVALID_INPUT_ERROR
                }
            }
        }
    }

def user_mutation_operation_error_response(mutation_name: str) -> dict:
    """Generate an operation error response for a user mutation.
    
    Args:
        mutation_name: The mutation name (e.g., "setEmail", "setAdmin")
    
    Returns:
        Error response dict
    """
    return {
        "admin": {
            "user": {
                "mutate": {
                    mutation_name: OPERATION_ERROR
                }
            }
        }
    }

def user_mutation_success_response(mutation_name: str) -> dict:
    """Generate a success response for a user mutation.
    
    Args:
        mutation_name: The mutation name (e.g., "setEmail", "setAdmin")
    
    Returns:
        Success response dict
    """
    return {
        "admin": {
            "user": {
                "mutate": {
                    mutation_name: USER
                }
            }
        }
    }

# Comprehensive response collections for easy access
ALL_USER_OPERATIONS = [
    "usersList", "usersGet", "usersCreate", "usersDelete",
    "usersSetEmail", "usersSetAdmin", "usersSetActive", "usersResetPassword",
    "usersSetRole", "usersAddRoles", "usersRemoveRoles"
]

ALL_ROLE_OPERATIONS = [
    "rolesList"
]

ALL_SSO_OPERATIONS = [
    "ssoConfigGet", "ssoConfigSet"
]

ALL_TABULATOR_OPERATIONS = [
    "bucketTabulatorTablesList", "bucketTabulatorTableSet", 
    "bucketTabulatorTableRename", "tabulatorGetOpenQuery", "tabulatorSetOpenQuery"
]

ALL_ADMIN_OPERATIONS = (
    ALL_USER_OPERATIONS + ALL_ROLE_OPERATIONS + 
    ALL_SSO_OPERATIONS + ALL_TABULATOR_OPERATIONS
)