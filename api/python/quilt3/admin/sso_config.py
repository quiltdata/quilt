import typing as T

from . import types, util


def get() -> T.Optional[types.SSOConfig]:
    """
    Get the current SSO configuration.
    """
    result = util.get_client().sso_config_get()
    return None if result is None else types.SSOConfig(**result.model_dump())


def set(config: T.Optional[str]) -> T.Optional[types.SSOConfig]:
    """
    Set the SSO configuration. Pass `None` to remove SSO configuration.
    """
    result = util.get_client().sso_config_set(config)
    return None if result is None else types.SSOConfig(**util.handle_errors(result).model_dump())
