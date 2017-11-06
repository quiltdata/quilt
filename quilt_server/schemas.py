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
        'public': {
            'type': 'boolean'
        },
        'description': {
            'type': 'string'
        },
        'contents': {
            'type': 'object',
            'properties': {
                'format' : {
                    # DEPRECATED.
                    'enum': [fmt.value for fmt in PackageFormat]
                },
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
        }
    },
    'required': ['description', 'contents'],
    'additionalProperties': False
}

LOG_SCHEMA = {
    'type': 'array',
    'items': {
        'type': 'object',
    }
}
