# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Definition of the package schema, helper functions, etc.
"""

from .core import (RootNode, GroupNode, TableNode, FileNode,
                   PackageFormat)

SHA256_PATTERN = r'[0-9a-f]{64}'

PACKAGE_SCHEMA = {
    'type': 'object',
    'properties': {
        'dry_run': {
            'type': 'boolean'
        },
        'is_public': {
            'type': 'boolean'
        },
        'is_team': {
            'type': 'boolean'
        },
        'public': {  # DEPRECATED
            'type': 'boolean'
        },
        'description': {
            'type': 'string'
        },
        'contents': {
            'oneOf': [
                {
                    'type': 'object',
                    'properties': {
                        'type': {
                            'enum': [RootNode.json_type]
                        },
                        'children': {
                            'type': 'object',
                            'additionalProperties': {
                                'oneOf': [
                                    {
                                        'type': 'object',
                                        'properties': {
                                            'type': {
                                                'enum': [FileNode.json_type]
                                            },
                                            'metadata': {
                                                'type': 'object'
                                            },
                                            'hashes': {
                                                'type': 'array',
                                                'items': {
                                                    'type': 'string',
                                                    'pattern': SHA256_PATTERN
                                                }
                                            },
                                            'metadata_hash': {
                                                'type': 'string',
                                                'pattern': SHA256_PATTERN
                                            }
                                        },
                                        'required': ['type', 'hashes'],
                                        'additionalProperties': False,
                                    },
                                    {
                                        'type': 'object',
                                        'properties': {
                                            'type': {
                                                'enum': [TableNode.json_type]
                                            },
                                            'format' : {
                                                'enum': [fmt.value for fmt in PackageFormat]
                                            },
                                            'metadata': {
                                                'type': 'object'
                                            },
                                            'hashes': {
                                                'type': 'array',
                                                'items': {
                                                    'type': 'string',
                                                    'pattern': SHA256_PATTERN
                                                }
                                            },
                                            'metadata_hash': {
                                                'type': 'string',
                                                'pattern': SHA256_PATTERN
                                            }
                                        },
                                        'required': ['type', 'hashes'],
                                        'additionalProperties': False,
                                    },
                                    {
                                        'type': 'object',
                                        'properties': {
                                            'type': {
                                                'enum': [GroupNode.json_type]
                                            },
                                            'children': {
                                                '$ref': '#/properties/contents/oneOf/0/properties/children'
                                            },
                                            'metadata_hash': {
                                                'type': 'string',
                                                'pattern': SHA256_PATTERN
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        'metadata_hash': {
                            'type': 'string',
                            'pattern': SHA256_PATTERN
                        }
                    },
                    'required': ['type', 'children'],
                    'additionalProperties': False
                },
                {
                    '$ref': '#/properties/contents/oneOf/0/properties/children/additionalProperties'
                }
            ]
        },
        'sizes': {
            'type': 'object',
            'additionalProperties': {
                'type': 'integer'
            }
        }
    },
    'required': ['description', 'contents', 'sizes'],
    'additionalProperties': False
}

LOG_SCHEMA = {
    'type': 'array',
    'items': {
        'oneOf': [
            # 'build' event; the only one currently supported.
            {
                'type': 'object',
                'properties': {
                    'type': {
                        'enum': ['build']
                    },
                },
                'required': ['type']
            }
        ]
    }
}

USERNAME_SCHEMA = {
    'type': 'object',
    'properties': {
        'username': {
            'type': 'string'
        }
    },
    'required': ['username'],
    'additionalProperties': False
}

EMAIL_SCHEMA = {
    'type': 'object',
    'properties': {
        'email': {
            'type': 'string'
        }
    },
    'required': ['email'],
    'additionalProperties': False
}

USERNAME_EMAIL_SCHEMA = {
    'type': 'object',
    'properties': {
        'username': {
            'type': 'string'
        },
        'email': {
            'type': 'string'
        }
    },
    'required': ['username', 'email'],
    'additionalProperties': False
}

GET_OBJECTS_SCHEMA = {
    'type': 'array',
    'items': {
        'type': 'string',
        'pattern': SHA256_PATTERN
    }
}

COMMENT_SCHEMA = {
    'type': 'object',
    'properties': {
        'contents': {
            'type': 'string'
        }
    },
    'required': ['contents'],
    'additionalProperties': False
}

USERNAME_PASSWORD_SCHEMA = {
    'type': 'object',
    'properties': {
        'username': {
            'type': 'string'
        },
        'password': {
            'type': 'string'
        }
    },
    'required': ['username', 'password'],
    'additionalProperties': False
}

USERNAME_ROLE_SCHEMA = {
    'type': 'object',
    'properties': {
        'username': {
            'type': 'string'
        },
        'role': {
            'type': 'string'
        }
    },
    'required': ['username', 'role'],
    'additionalProperties': False
}

ROLE_DETAILS_SCHEMA = {
    'type': 'object',
    'properties': {
        'name': {
            'type': 'string'
        },
        'arn': {
            'type': 'string'
        },
        'id': {
            'type': 'string'
        }
    },
    'required': ['name', 'arn'],
    'additionalProperties': False
}

USERNAME_PASSWORD_EMAIL_SCHEMA = {
    'type': 'object',
    'properties': {
        'username': {
            'type': 'string'
        },
        'password': {
            'type': 'string'
        },
        'email': {
            'type': 'string'
        }
    },
    'required': ['username', 'password', 'email'],
    'additionalProperties': False
}

PASSWORD_RESET_SCHEMA = {
    'type': 'object',
    'properties': {
        'password': {
            'type': 'string'
        },
        'link': {
            'type': 'string'
        }
    },
    'required': ['password', 'link'],
    'additionalProperties': False
}
