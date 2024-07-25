import typing as T

from . import util

def get() -> T.Optional[str]:
    """
    Get the current SSO configuration.
    """
    return util.get_client().get_sso_config()


def set(config: T.Optional[str]) -> None:
    """
    Set the SSO configuration.
    """
    util.handle_errors(util.get_client().set_sso_config(config))
