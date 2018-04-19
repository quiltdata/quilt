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
                                        '$ref': '#/properties/contents/properties/children'
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            'required': ['type', 'children'],
            'additionalProperties': False
        },
        'sizes': {
            'type': 'object',
            'additionalProperties': {
                'type': 'integer'
            }
        }
    },
    'required': ['description', 'contents'],
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
