import typing as T

from .. import _graphql_client
from . import exceptions, types


def handle_errors(result: _graphql_client.BaseModel) -> _graphql_client.BaseModel:
    if isinstance(result, (_graphql_client.InvalidInputSelection, _graphql_client.OperationErrorSelection)):
        raise exceptions.Quilt3AdminError(result)
    return result


def _to_dict(obj: _graphql_client.BaseModel) -> dict:
    return obj.model_dump()


def parse_role_result(role: _graphql_client.BaseModel) -> types.Role:
    return types.role_adapter.validate_python(_to_dict(role))


def parse_policy_result(policy: _graphql_client.BaseModel) -> types.Policy:
    return types.Policy(**_to_dict(policy))


def parse_user_result(user: _graphql_client.BaseModel) -> types.User:
    return types.User(**_to_dict(user))


def handle_user_mutation(result: _graphql_client.BaseModel) -> types.User:
    return parse_user_result(handle_errors(result))


def parse_sso_config_result(config: _graphql_client.BaseModel) -> types.SSOConfig:
    return types.SSOConfig(**_to_dict(config))


def raise_invalid_input(error: _graphql_client.InvalidInputSelection) -> T.NoReturn:
    first_error = error.errors[0] if error.errors else None
    if first_error is None:
        raise exceptions.InvalidInputError(error)
    if first_error.name == "PolicyDoesNotExist":
        raise exceptions.PolicyNotFoundError()
    if first_error.name == "PolicyTitleConflict":
        raise exceptions.PolicyTitleExistsError(error)
    if first_error.name == "PolicyArnConflict":
        raise exceptions.PolicyArnExistsError(error)
    if first_error.name == "RoleHasTooManyPoliciesToAttach":
        raise exceptions.RoleTooManyPoliciesError(error)
    raise exceptions.InvalidInputError(error)


def raise_operation_error(error: _graphql_client.OperationErrorSelection) -> T.NoReturn:
    raise exceptions.OperationError(error)


def get_client():
    return _graphql_client.Client()
