import contextvars

from . import async_cache

QUILT_CONTEXT = contextvars.ContextVar("quilt_context")


class QuiltContext:
    def __init__(self):
        self.cache = {}

    def __enter__(self):
        self._token = QUILT_CONTEXT.set(self)

    def __exit__(self, *_):
        QUILT_CONTEXT.reset(self._token)


class ContextCache:
    def __init__(self, key):
        self._key = key

    @property
    def _cache(self):
        cache = QUILT_CONTEXT.get().cache
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
