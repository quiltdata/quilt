import typing as T

import boto3


class BuildClientBase(T.Protocol):
    def __call__(self, session: boto3.Session, client_kwargs: dict): ...


class BuildClientHook(T.Protocol):
    def __call__(self, build_client_base: BuildClientBase, session: boto3.Session, client_kwargs: dict): ...


_build_client_hook = None


def set_build_client_hook(hook: T.Optional[BuildClientHook]) -> T.Optional[BuildClientHook]:
    global _build_client_hook
    old_hook = _build_client_hook
    _build_client_hook = hook
    return old_hook


def get_build_client_hook() -> T.Optional[BuildClientHook]:
    return _build_client_hook
