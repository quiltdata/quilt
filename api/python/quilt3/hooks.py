import typing as T

import boto3


class BuildClientBase(T.Protocol):
    def __call__(self, session: boto3.Session, client_kwargs: dict[str, T.Any], **kwargs): ...


class BuildClientHook(T.Protocol):
    def __call__(
        self, build_client_base: BuildClientBase, session: boto3.Session, client_kwargs: dict[str, T.Any], **kwargs
    ): ...


_build_client_hook = None


def get_build_s3_client_hook() -> T.Optional[BuildClientHook]:
    """
    Return build S3 client hook.
    """

    return _build_client_hook


def set_build_s3_client_hook(hook: T.Optional[BuildClientHook]) -> T.Optional[BuildClientHook]:
    """
    Set build S3 client hook.

    Example for overriding `ServerSideEncryption` parameter for certain S3 operations:

    ```python
    from quilt3.hooks import set_build_s3_client_hook

    def event_handler(params, **kwargs):
        # Be mindful with parameters you set here.
        # Specifically it's not recommended to override/delete already set parameters
        # because that can break quilt3 logic.
        params.setdefault("ServerSideEncryption", "AES256")

    def hook(build_client_base, session, client_kwargs, **kwargs):
        client = build_client_base(session, client_kwargs, **kwargs)
        # Docs for boto3 events system we use below:
        # https://boto3.amazonaws.com/v1/documentation/api/latest/guide/events.html
        for op in (
            "CreateMultipartUpload",
            "CopyObject",
            "PutObject",
        ):
            client.meta.events.register(f"before-parameter-build.s3.{op}", event_handler)
        return client
    
    old_hook = set_build_s3_client_hook(hook)
    ```

    Args:
        hook: Build client hook.

    Returns:
        Old build client hook.
    """
    global _build_client_hook
    old_hook = _build_client_hook
    _build_client_hook = hook
    return old_hook
