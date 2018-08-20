"""
Helper functions.
"""

import numpy as np
from . import nodes
from .tools.command import build_from_node, build, push

def save(package, data, params={}, is_public=False):
    """Build and push data to Quilt registry at user/package/data_node,
    associating params as metadata for the data node.
    :param package: short package specifier string, i.e. 'team:user/pkg'
    :param data: data to save (np.ndarray or pd.DataFrame)
    :param params: metadata dictionary
    :param is_public: boolean kwarg to push the packages publicly
    """
    for key, value in params.items():
        if isinstance(value, np.ndarray):
            value = value.astype(float)
            params[key] = value.tolist()
    build_from_node(package, nodes.DataNode(None, None, data, params))
    build('{}'.format(package))
    push('{}'.format(package), is_public=is_public)

