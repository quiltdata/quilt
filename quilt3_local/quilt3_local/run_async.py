import asyncio


async def run_async(fn, executor=None, loop=None):
    if loop is None:
        loop = asyncio.get_running_loop()
    return await loop.run_in_executor(executor, fn)
