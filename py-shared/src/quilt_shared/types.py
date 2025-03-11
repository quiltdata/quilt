import functools
import typing as T

import pydantic.v1
import typing_extensions as TX


class NonEmptyStr(pydantic.v1.ConstrainedStr):
    min_length = 1
    strip_whitespace = True


ConsParams = TX.ParamSpec("ConsParams")
ConsReturn = T.TypeVar("ConsReturn")
FnReturn = T.TypeVar("FnReturn")


def unpack_model(
    cls: T.Callable[ConsParams, ConsReturn],
) -> T.Callable[[T.Callable[[ConsReturn], FnReturn]], T.Callable[ConsParams, FnReturn]]:
    """
    Make the function accept the same parameters as the constructor of the given model.
    The decorated function will be called with a validated instance of the model.
    """

    def decorate(fn: T.Callable[[ConsReturn], FnReturn]) -> T.Callable[ConsParams, FnReturn]:
        @functools.wraps(fn)
        def wrapper(*a: ConsParams.args, **kw: ConsParams.kwargs) -> FnReturn:
            return fn(cls(*a, **kw))

        return wrapper

    return decorate
