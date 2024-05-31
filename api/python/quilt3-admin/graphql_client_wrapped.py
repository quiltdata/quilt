from typing import Any, Union, Optional, List

from graphql_client import *
from graphql_client.base_model import UNSET, UnsetType


def handle_errors(result: Any) -> Any:
    if isinstance(result, (InvalidInputSelection, OperationErrorSelection)):
        raise Exception(result)  # TODO: Proper error handling
    return result


class Client(Client):
    def create_user(self, input: UserInput, **kwargs: Any) -> None:
        handle_errors(super().create_user(input=input, **kwargs))
        return None

    def set_roles(
        self,
        name: str,
        role: str,
        extra_roles: Union[Optional[List[str]], UnsetType] = UNSET,
        **kwargs: Any
    ) -> None:
        result = super().set_roles(name=name, role=role, extra_roles=extra_roles, **kwargs)
        if result is None:
            raise Exception("User not found")  # TODO: Proper error handling
        handle_errors(result.set_role)
        return None
