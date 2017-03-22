"""
Definition of the package schema, helper functions, etc.
"""

from .core import RootNode, GroupNode, TableNode, FileNode

SHA256_PATTERN = r'[0-9a-f]{64}'

PACKAGE_SCHEMA = {
    'type': 'object',
    'properties': {
        'description': {
            'type': 'string'
        },
        'contents': {
            'type': 'object',
            'properties': {
                'format' : {
                    'enum': ['HDF5', 'ARROW_PARQUET', 'FAST_PARQUET']
                },
                'type': {
                    'enum': [RootNode.json_type, GroupNode.json_type]
                },
                'children': {
                    'type': 'object',
                    'additionalProperties': {
                        'oneOf': [
                            {
                                'type': 'object',
                                'properties': {
                                    'type': {
                                        'enum': [TableNode.json_type, FileNode.json_type]
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
                                '$ref': '#/properties/contents'
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
