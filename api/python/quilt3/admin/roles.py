from typing import List

from . import types, util


def list() -> List[types.Role]:
    """
    Get a list of all roles in the registry.
    """
    return [types.role_adapter.validate_python(r.model_dump()) for r in util.get_client().roles_list()]
