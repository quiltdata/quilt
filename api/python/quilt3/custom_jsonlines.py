"""
jsonlines implementation
"""

import numbers
import io
import json

import six


TYPE_MAPPING = {
    dict: dict,
    list: list,
    str: six.text_type,
    int: six.integer_types,
    float: float,
    numbers.Number: numbers.Number,
    bool: bool,
}


class Error(Exception):
    """Base error class."""
    pass


class InvalidLineError(Error, ValueError):
    """
    Error raised when an invalid line is encountered.

    This happens when the line does not contain valid JSON, or if a
    specific data type has been requested, and the line contained a
    different data type.

    The original line itself is stored on the exception instance as the
    ``.line`` attribute, and the line number as ``.lineno``.

    This class subclasses both ``jsonlines.Error`` and the built-in
    ``ValueError``.
    """
    #: The invalid line
    line = None

    #: The line number
    lineno = None

    def __init__(self, msg, line, lineno):
        msg = "{} (line {})".format(msg, lineno)
        self.line = line.rstrip()
        self.lineno = lineno
        super(InvalidLineError, self).__init__(msg)


class ReaderWriterBase(object):
    """
    Base class with shared behaviour for both the reader and writer.
    """
    def close(self):
        """
        Close this reader/writer.

        This closes the underlying file if that file has been opened by
        this reader/writer. When an already opened file-like object was
        provided, the caller is responsible for closing it.
        """
        if self._closed:
            return
        self._closed = True
        if self._should_close_fp:
            self._fp.close()

    def __repr__(self):
        name = getattr(self._fp, 'name', None)
        if name:
            wrapping = repr(name)
        else:
            wrapping = '<{} at 0x{:x}>'.format(
                type(self._fp).__name__,
                id(self._fp))
        return '<jsonlines.{} at 0x{:x} wrapping {}>'.format(
            type(self).__name__, id(self), wrapping)

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()
        return False


class Reader(ReaderWriterBase):
    """
    Reader for the jsonlines format.

    The first argument must be an iterable that yields JSON encoded
    strings. Usually this will be a readable file-like object, such as
    an open file or an ``io.TextIO`` instance, but it can also be
    something else as long as it yields strings when iterated over.

    The `loads` argument can be used to replace the standard json
    decoder. If specified, it must be a callable that accepts a
    (unicode) string and returns the decoded object.

    Instances are iterable and can be used as a context manager.

    :param file-like iterable: iterable yielding lines as strings
    :param callable loads: custom json decoder callable
    """
    def __init__(self, iterable, loads=None):
        self._fp = iterable
        self._should_close_fp = False
        self._closed = False
        if loads is None:
            loads = json.loads
        self._loads = loads
        self._line_iter = enumerate(iterable, 1)

    def read(self, type=None, allow_none=False, skip_empty=False):
        """
        Read and decode a line.

        The optional `type` argument specifies the expected data type.
        Supported types are ``dict``, ``list``, ``str``, ``int``,
        ``float``, ``numbers.Number`` (accepts both integers and
        floats), and ``bool``. When specified, non-conforming lines
        result in :py:exc:`InvalidLineError`.

        By default, input lines containing ``null`` (in JSON) are
        considered invalid, and will cause :py:exc:`InvalidLineError`.
        The `allow_none` argument can be used to change this behaviour,
        in which case ``None`` will be returned instead.

        If `skip_empty` is set to ``True``, empty lines and lines
        containing only whitespace are silently skipped.
        """
        if self._closed:
            raise RuntimeError('reader is closed')
        if type is not None and type not in TYPE_MAPPING:
            raise ValueError("invalid type specified")

        try:
            lineno, line = next(self._line_iter)
            while skip_empty and not line.rstrip():
                lineno, line = next(self._line_iter)
        except StopIteration:
            six.raise_from(EOFError, None)

        if isinstance(line, six.binary_type):
            try:
                line = line.decode('utf-8')
            except UnicodeDecodeError as orig_exc:
                exc = InvalidLineError(
                    "line is not valid utf-8: {}".format(orig_exc),
                    line, lineno)
                six.raise_from(exc, orig_exc)

        try:
            value = self._loads(line)
        except ValueError as orig_exc:
            exc = InvalidLineError(
                "line contains invalid json: {}".format(orig_exc),
                line, lineno)
            six.raise_from(exc, orig_exc)

        if value is None:
            if allow_none:
                return None
            raise InvalidLineError(
                "line contains null value", line, lineno)

        if type is not None:
            valid = isinstance(value, TYPE_MAPPING[type])
            if type in (int, numbers.Number):
                valid = valid and not isinstance(value, bool)
            if not valid:
                raise InvalidLineError(
                    "line does not match requested type", line, lineno)

        return value

    def iter(self, type=None, allow_none=False, skip_empty=False,
             skip_invalid=False):
        """
        Iterate over all lines.

        This is the iterator equivalent to repeatedly calling
        :py:meth:`~Reader.read()`. If no arguments are specified, this
        is the same as directly iterating over this :py:class:`Reader`
        instance.

        When `skip_invalid` is set to ``True``, invalid lines will be
        silently ignored.

        See :py:meth:`~Reader.read()` for a description of the other
        arguments.
        """
        try:
            while True:
                try:
                    yield self.read(
                        type=type,
                        allow_none=allow_none,
                        skip_empty=skip_empty)
                except InvalidLineError:
                    if not skip_invalid:
                        raise
        except EOFError:
            pass

    def __iter__(self):
        """
        See :py:meth:`~Reader.iter()`.
        """
        return self.iter()












import multiprocessing as mp
import ujson
import itertools

def parse_json_lines(str_lines, output_queue):

    for str_line in str_lines:
        j = ujson.loads(str_line)
        output_queue.put(j)


class FastMultiProcessReader(ReaderWriterBase):
    """
    Not actually fast. 3x slower than serial reading...

    jsonlines reader focused on speed for large JSONL files (~120k lines, ~650MB)

    Specifically built for Quilt:
    - Header line is special and accessed immediately
    - The header line will be read first, but after that the order does not matter. `read()` can return first available
    - Calling code will use __iter__ and do a small, but non-trivial amount of work per line


    Ideas:
    - Low-resource background thread(s) that start parsing the lines immediately
    - Quickly chunk file and distribute to multiple processes

    TODO: Ensure that we parse all lines correctly
    TODO: Handle JSON parsing errors

    """
    def __init__(self, fp, num_lines=None):

        self.num_lines = num_lines
        if self.num_lines is None:
            self.num = 0
            for line in fp:
                self.num_lines += 1
            fp.seek(0)

        self.mp_manager = mp.Manager()
        self.result_queue = self.mp_manager.Queue()

        POOL_WORKERS = 1
        self.pool = mp.Pool(POOL_WORKERS)

        passed_header = False
        chunk_size = 500
        chunk = []
        for line in fp:

            if not passed_header:
                self.result_queue.put(ujson.loads(line))  # Make sure header line is always the first item returned
                passed_header = True
                continue

            chunk.append(line)
            if len(chunk) == chunk_size:
                self.pool.apply_async(parse_json_lines, args=(chunk, self.result_queue))
                chunk = []
        self.pool.apply_async(parse_json_lines, args=(chunk, self.result_queue))
        print("Done with async_apply")

        self.lines_read = 0

    def read(self):
        # print("READING!")
        if self.lines_read == self.num_lines:
            raise RuntimeError("All lines of this JSONL have already been read!")

        r = self.result_queue.get(block=True)
        self.lines_read += 1
        return r

    def iter(self):
        for _ in range(self.num_lines):
            yield self.read()


    def __iter__(self):
        return self.iter()

from concurrent.futures import ThreadPoolExecutor
import time



class BackgroundThreadReader(ReaderWriterBase):

    def parse_json_line(self, str_line):
        print("Entered parse_json_line")
        j = ujson.loads(str_line)
        self.result_queue.append(j)
        print("Finished parse_json_line")

    def fill_job_queue(self):
        if len(self.job_queue) == 0:
            return

        try:
            next_line = self.job_queue.pop(0)
        except IndexError:
            # Queue is empty
            print("Done! Job Queue is empty" )
            return

        print("Adding item to ")
        self.worker_thread_pool.submit(self.parse_json_line, next_line)


    def __init__(self, fp, num_lines=None):

        self.num_lines = num_lines
        if self.num_lines is None:
            self.num = 0
            for line in fp:
                self.num_lines += 1
            fp.seek(0)

        self.background_thread_pool = ThreadPoolExecutor(max_workers=2)
        self.worker_thread_pool = ThreadPoolExecutor(max_workers=20)

        self.result_queue = []


        header = fp.readline()
        self.result_queue.append(ujson.loads(header))  # Make sure header line is always the first item returned

        self.job_queue = [line for line in fp]

        self.background_thread_pool.submit(self.fill_job_queue)

        self.lines_read = 0

    def read(self):
        # print("READING!")
        if self.lines_read > self.num_lines:
            raise RuntimeError("All lines of this JSONL have already been read!")

        while True:
            if len(self.result_queue) == 0:
                try:

                    next_line = self.job_queue.pop(0)
                except IndexError:
                    # Job Queue is empty. Somehow we hit the moment after the last line was pulled from the job_queue
                    # and before it was pushed to the result_queue, Nothing to do, but wait.
                    time.sleep(0.01)
                    continue
                j = ujson.loads(next_line)
                self.lines_read += 1
                return j

            r = self.result_queue.pop(0)
            self.lines_read += 1
            return r

    def iter(self):
        for _ in range(self.num_lines):
            yield self.read()

    def __iter__(self):
        return self.iter()


import os
import random


def humanize_float(num): return "{0:,.2f}".format(num)

class Timer:
    def __init__(self, name):
        self.name = name
        self.t1 = None
        self.t2 = None

    def start(self):
        print(f'Timer "{self.name}" starting!')
        self.t1 = time.time()
        return self

    def stop(self):
        self.t2 = time.time()
        print(f'Timer "{self.name}" took {humanize_float(self.t2-self.t1)} seconds')
        return self.t2-self.t1


class BackgroundThreadReader2(ReaderWriterBase):

    def parse_json_line(self, i):
        while True:
            try:
                next_line = self.job_queues[i].pop(0)
            except IndexError:  # Queue is empty
                return
            j = ujson.loads(next_line)
            self.result_queues[i].append(j)

    def __init__(self, fp, num_lines=None):

        init_timer = Timer("BackgroundThreadReader2 init").start()

        self.num_lines = num_lines
        if self.num_lines is None:
            self.num = 0
            for line in fp:
                self.num_lines += 1
            fp.seek(0)

        self.max_workers = int(os.getenv("QUILT_MAX_WORKERS", 10))
        self.worker_thread_pool = ThreadPoolExecutor(max_workers=self.max_workers)

        self.result_queue = []




        self.job_queues = {i: [] for i in range(self.max_workers)}
        self.result_queues = {i: [] for i in range(self.max_workers)}

        header = fp.readline()
        self.result_queues[0].append(ujson.loads(header))  # Make sure header line is always the first item returned
        self.header_pending = True

        job_queue_assignment_timer = Timer("Job queue assignment").start()
        for i, line in enumerate(fp):

            self.job_queues[i%self.max_workers].append(line)

        # self.job_queue = [line for line in fp]

        job_queue_assignment_timer.stop()

        print(f"Num lines: {self.num_lines}")
        for i in range(self.max_workers):
            print(f"Job Queue {i} length: {len(self.job_queues[i])}")
        for i in range(self.max_workers):
            print(f"Result Queue {i} length: {len(self.result_queues[i])}")

        worker_thread_submit_timer = Timer("Worker thread submit").start()

        for i in range(self.max_workers):
            self.worker_thread_pool.submit(self.parse_json_line, i)

        worker_thread_submit_timer.stop()

        self.lines_read = 0

        init_timer.stop()

    def read(self):
        if self.header_pending:
            r = self.result_queues[0].pop(0)
            self.header_pending = False
            self.lines_read += 1
            return r
        # print("READING!")
        if self.lines_read > self.num_lines:
            raise RuntimeError("All lines of this JSONL have already been read!")
        worker_list = list(range(self.max_workers))
        while True:
            for i in range(self.max_workers):
            # for i in sorted(worker_list, key=lambda _: random.random()):
                try:
                    r = self.result_queues[i].pop(0)
                    self.lines_read += 1
                    return r
                except IndexError:
                    continue

            # None of the queues have any results
            for i in range(self.max_workers):
            # for i in sorted(worker_list, key=lambda _: random.random()):
                try:
                    next_line = self.job_queues[i].pop(0)
                except IndexError:  # Queue is empty
                    continue
                j = ujson.loads(next_line)
                self.lines_read += 1
                return j

            # print("No results are ready :(")
            # print("Are there jobs in the job queues?")
            # for i in range(self.max_workers):
            #     print(f"Job Queue {i} length: {len(self.job_queues[i])}")
            time.sleep(0.1)

    def iter(self):
        for _ in range(self.num_lines - self.lines_read):
            yield self.read()

    def __iter__(self):
        return self.iter()













def chunk_file(fp, approx_chunk_size=100_000):
    # Split the file into groups of lines
    # Return a list of tuples: (start_loc, end_loc)
    chunks = []


    while True:
        chunk = fp.read(approx_chunk_size)
        chunk += fp.readline()
        # print(len(chunk))
        if chunk == "":
            return chunks

        chunks.append(chunk)









def parse_line_group(line_group):
    t0 = time.time()
    l = line_group.rstrip("\n").replace("\n", ",\n")
    l = f"[{l}]"
    t1 = time.time()
    # array_of_jsons = ujson.loads(l)
    array_of_jsons = json.loads(l)
    t2 = time.time()

    replace_dur = t1-t0
    loads_dur = t2-t1

    # print(humanize_float(replace_dur), humanize_float(loads_dur), len(array_of_jsons))
    return array_of_jsons

class LineChunkerReader(ReaderWriterBase):


    def __init__(self, fp):
        init_timer = Timer("LineChunkerReader init").start()

        self.num_workers = int(os.getenv("QUILT_NUM_WORKERS", 5))
        self.chunk_size = os.getenv("QUILT_CHUNK_SIZE", "100_000")
        self.chunk_size = int(self.chunk_size.replace("_", ""))

        chunk_timer = Timer("Chunking").start()
        header_line = fp.readline()
        line_groups = chunk_file(fp, self.chunk_size)
        print(f"Num chunks = {len(line_groups)}")
        chunk_timer.stop()



        print(f"Chunk size = {humanize_float(self.chunk_size)}")
        self.pool = mp.Pool(self.num_workers)

        chunk_timer = Timer("Chunk map").start()
        results = self.pool.map(parse_line_group, line_groups)
        chunk_timer.stop()

        self.lines = [ujson.loads(header_line)]
        for result_batch in results:
            self.lines.extend(result_batch)

        init_timer.stop()







    def read(self):
        return self.lines.pop(0)

    def iter(self):

        yield from self.lines

    def __iter__(self):
        return self.iter()














class Writer(ReaderWriterBase):
    """
    Writer for the jsonlines format.

    The `fp` argument must be a file-like object with a ``.write()``
    method accepting either text (unicode) or bytes.

    The `compact` argument can be used to to produce smaller output.

    The `sort_keys` argument can be used to sort keys in json objects,
    and will produce deterministic output.

    For more control, provide a a custom encoder callable using the
    `dumps` argument. The callable must produce (unicode) string output.
    If specified, the `compact` and `sort` arguments will be ignored.

    When the `flush` argument is set to ``True``, the writer will call
    ``fp.flush()`` after each written line.

    Instances can be used as a context manager.

    :param file-like fp: writable file-like object
    :param bool compact: whether to use a compact output format
    :param bool sort_keys: whether to sort object keys
    :param callable dumps: custom encoder callable
    :param bool flush: whether to flush the file-like object after
        writing each line
    """
    def __init__(
            self, fp, compact=False, sort_keys=False, dumps=None, flush=False):
        self._closed = False
        try:
            fp.write(u'')
            self._fp_is_binary = False
        except TypeError:
            self._fp_is_binary = True
        if dumps is None:
            encoder_kwargs = dict(ensure_ascii=False, sort_keys=sort_keys)
            if compact:
                encoder_kwargs.update(separators=(',', ':'))
            dumps = json.JSONEncoder(**encoder_kwargs).encode
        self._fp = fp
        self._should_close_fp = False
        self._dumps = dumps
        self._flush = flush

    def write(self, obj):
        """
        Encode and write a single object.

        :param obj: the object to encode and write
        """
        if self._closed:
            raise RuntimeError('writer is closed')
        line = self._dumps(obj)
        # On Python 2, the JSON module has the nasty habit of returning
        # either a byte string or unicode string, depending on whether
        # the serialised structure can be encoded using ASCII only, so
        # this means this code needs to handle all combinations.
        if self._fp_is_binary:
            if not isinstance(line, six.binary_type):
                line = line.encode('utf-8')
            self._fp.write(line)
            self._fp.write(b'\n')
        else:
            if not isinstance(line, six.text_type):
                line = line.decode('ascii')  # For Python 2.
            self._fp.write(line)
            self._fp.write(u'\n')
        if self._flush:
            self._fp.flush()

    def write_all(self, iterable):
        """
        Encode and write multiple objects.

        :param iterable: an iterable of objects
        """
        for obj in iterable:
            self.write(obj)


def open(name, mode='r', **kwargs):
    """
    Open a jsonlines file for reading or writing.

    This is a convenience function that opens a file, and wraps it in
    either a :py:class:`Reader` or :py:class:`Writer` instance,
    depending on the specified `mode`.

    Any additional keyword arguments will be passed on to the reader and
    writer: see their documentation for available options.

    The resulting reader or writer must be closed after use by the
    caller, which will also close the opened file.  This can be done by
    calling ``.close()``, but the easiest way to ensure proper resource
    finalisation is to use a ``with`` block (context manager), e.g.

    ::

        with jsonlines.open('out.jsonl', mode='w') as writer:
            writer.write(...)

    :param file-like fp: name of the file to open
    :param str mode: whether to open the file for reading (``r``),
        writing (``w``) or appending (``a``).
    :param **kwargs: additional arguments, forwarded to the reader or writer
    """
    if mode not in {'r', 'w', 'a'}:
        raise ValueError("'mode' must be either 'r', 'w', or 'a'")
    fp = io.open(name, mode=mode + 't', encoding='utf-8')
    if mode == 'r':
        instance = Reader(fp, **kwargs)
    else:
        instance = Writer(fp, **kwargs)
    instance._should_close_fp = True
    return instance