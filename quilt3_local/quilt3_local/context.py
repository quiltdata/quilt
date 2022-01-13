# TODO: move this to a reusable package
import asyncio
import contextlib
import contextvars
import functools

from . import async_cache

QUILT_CONTEXT = contextvars.ContextVar("quilt_context")


class QuiltContext:
    def __init__(self):
        self.cache = {}
        self._tasks = set()

    async def __aenter__(self):
        self.context_stack = contextlib.AsyncExitStack()
        _token = QUILT_CONTEXT.set(self)
        self.context_stack.callback(QUILT_CONTEXT.reset, _token)

    async def __aexit__(self, *_):
        await self.context_stack.aclose()


def get_current_context():
    return QUILT_CONTEXT.get()


def get_cache():
    return get_current_context().cache


class ContextCache:
    def __init__(self, key):
        self._key = key

    @property
    def _cache(self):
        cache = get_cache()
        if self._key not in cache:
            cache[self._key] = {}
        return cache[self._key]

    def __getitem__(self, key):
        return self._cache[key]

    def __setitem__(self, key, val):
        self._cache[key] = val

    def __contains__(self, item):
        return item in self._cache


# Memoize the given function (both sync and async functions supported)
# in the current context (cache doesn't persist between requests).
cached = async_cache.cached(ContextCache)


async def enter_async_context(*args):
    return await get_current_context().context_stack.enter_async_context(*args)


# TODO: rm, unused
async def run_async(fn):
    """
    Run a sync (blocking) function asynchronously (in thread pool and asyncio
    loop from the current context) with the current context.
    """
    loop = asyncio.get_running_loop()
    ctx = contextvars.copy_context()
    return await loop.run_in_executor(None, functools.partial(ctx.run, fn))


# TODO: rm, unused
def make_async(f):
    @functools.wraps(f)
    async def wrapper(*args, **kwargs):
        return await run_async(functools.partial(f, *args, **kwargs))

    return wrapper
