import typing as T

from . import types, util


def get() -> T.Optional[types.SSOConfig]:
    """
    Get the current SSO configuration.
    """
    result = util.get_client().sso_config_get()
    return None if result is None else types.SSOConfig(**result.model_dump())


def set(config: T.Optional[str]) -> None:
    """
    Set the SSO configuration.
    """
    util.handle_errors(util.get_client().sso_config_set(config))
