# TODO: move this to a reusable package
import asyncio
import functools
from typing import Any, cast

import cachetools.keys


class NotCached(Exception):
    pass


def _done_callback(fut, task):
    if task.cancelled():
        fut.cancel()
        return

    exc = task.exception()
    if exc is not None:
        fut.set_exception(exc)
        return

    fut.set_result(task.result())


def cached(cache=lambda _: {}, key=cachetools.keys.hashkey):
    def decorate(fn):
        if not callable(fn):
            raise TypeError(f"Decorating {fn} is not supported")

        _cache = cache(fn) if callable(cache) else cache

        if asyncio.iscoroutinefunction(fn):
            tasks = set()

            @functools.wraps(fn)
            async def wrapper(*args, **kwargs):
                k = key(*args, **kwargs)
                try:
                    fut = _cache[k]
                except KeyError:
                    pass
                else:
                    return fut.result() if fut.done() else await asyncio.shield(fut)

                loop = asyncio.get_running_loop()
                fut = loop.create_future()
                task = loop.create_task(fn(*args, **kwargs))
                task.add_done_callback(functools.partial(_done_callback, fut))
                tasks.add(task)
                task.add_done_callback(tasks.discard)
                _cache[k] = fut

                return await asyncio.shield(fut)

            def schedule(*args, **kwargs):
                task = asyncio.create_task(wrapper(*args, **kwargs))
                tasks.add(task)
                task.add_done_callback(tasks.discard)

            cast(Any, wrapper).schedule = schedule

        else:
            @functools.wraps(fn)
            def wrapper(*args, **kwargs):
                k = key(*args, **kwargs)
                if k not in _cache:
                    _cache[k] = fn(*args, **kwargs)
                return _cache[k]

        def get_cached(*args, **kwargs):
            k = key(*args, **kwargs)
            try:
                return _cache[k]
            except KeyError:
                raise NotCached

        wrapper_with_attrs = cast(Any, wrapper)
        wrapper_with_attrs._cache = _cache
        wrapper_with_attrs.get_cached = get_cached
        wrapper_with_attrs.NotCached = NotCached

        return wrapper

    return decorate
