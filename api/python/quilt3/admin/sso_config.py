from . import types, util


def get() -> types.SSOConfig | None:
    """
    Get the current SSO configuration.
    """
    result = util.get_client().sso_config_get()
    return None if result is None else types.SSOConfig.from_gql(result)


def set(config: str | None) -> types.SSOConfig | None:
    """
    Set the SSO configuration. Pass `None` to remove SSO configuration.
    """
    result = util.get_client().sso_config_set(config)
    return None if result is None else types.SSOConfig.from_gql(util.handle_errors(result))
