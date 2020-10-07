""" formats.py

This module handles binary formats, and conversion to/from objects.

# FormatRegistry Class (singleton)

The `FormatsRegistry` class acts as a global container for registered formats,
and provides a place to register and discover formats.

Formats may be discovered by:
    * metadata
    * file extension
    * serializable object

..as well as other types in the future, potentially.

Format objects are registered with the FormatsRegistry class by calling
`FormatRegistry.register(format_obj)`, or `format_obj.register()`.


# FormatHandler Class

A Format is tied to *logical key* metadata.  This is because the underlying
data for each of the physical keys must be the same for the hashes to match,
so variances in format between physical keys cannot be tolerated, unless there
is also a change to what data the logical key references.

A FormatHandler has, at bare minimum:
    * a name specific to the format used (NOT to the format handler used)
      * I.e., two FormatHandler objects that both handle JSON should both be
        named 'json'
    * a serializer
    * a deserializer

Aside from that, a FormatHandler *should* have:
    * a list of filename extensions it can (theoretically) handle
    * a list of object types it can handle

Format objects can be registered directly by calling "f.register()".


# Format metadata

In an object's metadata, the format should only touch the 'format' key,
and possibly the 'target' key.

Format metadata has the following form:

```
{
  # 'name':
  #     a unique format name, like csv, json, parquet, numpy, etc
  'name': 'csv',

  # 'opts', I.e. Format Options:
  #     Options to help in serialization/deserialization.
  #     * opts are needed when a format is leaky/ill-defined, as with CSV.
  #     * opts should not exactly match underlying serializer/deserializer
  #       args unless known to be safe or analyzed at runtime for safety.
  #     * opts should be kept as platform-independent as possible.
  #     * option names must be present in <format_handler>.opts, or a warning
  #       will be shown, and the option will be ignored.
  'opts': {<option name>: <option value>}
}

"""


import copy
import csv
import io
import json
import sys
import warnings
from abc import ABC, abstractmethod
from collections import defaultdict

from .util import QuiltException

# Constants
NOT_SET = type('NOT_SET', (object,), {
    '__doc__': "A unique indicator of disuse when `None` is a valid value",
})()


# Code
class FormatRegistry:
    """A collection for organizing `FormatHandler` objects.

    This class organizes `FormatHandler` objects for querying and general use.
    It provides methods for querying by format name, metadata dict, handled
    extensions, or handled object types.  This list may expand in the future,
    so see the actual class methods.
    """
    registered_handlers = []

    # latest adds are last, and come first in lookups by type via `for_obj`.
    def __init__(self):
        raise TypeError("The {!r} class is organizational, and cannot be instantiated."
                        .format(type(self).__name__))

    @classmethod
    def register(cls, handler):
        """Register a FormatHandler instance"""
        handlers = cls.registered_handlers

        # no duplicates, just reprioritize.
        if handler in handlers:
            handlers.pop(handlers.index(handler))

        handlers.insert(0, handler)

    @classmethod
    def search(cls, obj_type=None, meta=None, ext=None):
        """Get a handler or handlers meeting the specified requirements

        Preference:
            Registered handlers are filtered by `obj_type`, then by `meta`,
            then sorted by `ext`.  If any of these aren't given, that action
            is skipped.

            If only `ext` is given, it will be used as a fallback, and only
            handlers that can handle that extension will be returned.

            All other factors being equal, latest-added handlers have
            preference over earlier handlers.

        Args:
            obj_type: type of object to convert from/to
                If given, the returned handler(s) *must* handle this type.
            meta: object metadata, potentially containing format metadata
                If given, and the metadata contains format metadata with a
                format name, then the returned handler(s) *must* handle the
                named format.
            ext: The filename extension for the data
                If given, then if other methods fail or are not specified,
                the handler(s) for the extension `ext` will be returned.
                If other methods do not fail, any handlers that support the
                specified extension will be moved to the front of the result
                list.

        Returns:
            list: Matching formats

        Raises:
            QuiltException: Reason no matching formats were found
        """
        # Reasons to use lists and not sets:
        # * we want to retain order, so recently added formats take precedence
        # * at this scale, lists are faster than sets
        typ_fmts = cls.for_type(obj_type)  # required if present
        meta_fmts = cls.for_meta(meta)     # required if present
        ext_fmts = cls.for_ext(ext)        # preferred if present, but not required

        fmt_name = cls._get_name_from_meta(meta)

        # lookup by object type -- required to match if given
        if obj_type is not None:
            results = typ_fmts
            if not results:
                raise QuiltException("No format handler for type {!r}".format(obj_type))

            # limit by metadata - required to match, if present
            if fmt_name:
                results = [fmt for fmt in typ_fmts if fmt in meta_fmts]
                if not results:
                    raise QuiltException(
                        f"Metadata requires format {fmt_name!r} for specified type {obj_type!r}, "
                        "but no registered handler can fulfill both conditions."
                    )
            # stable sort -- if any formats match on extension, sort to front
            return sorted(results, key=lambda fmt: fmt not in ext_fmts)

        # lookup by metadata - required to match, if present
        if fmt_name:
            if not meta_fmts:
                raise QuiltException(
                    f"Metadata requires the {fmt_name} format, but no handler is registered for it"
                )
            # stable sort -- if any formats match on extension, sort to front
            return sorted(meta_fmts, key=lambda fmt: fmt not in ext_fmts)

        # Fall back to extension matches.
        if not ext_fmts:
            raise QuiltException("No object type or metadata specified, and guessing by extension failed.")
        return ext_fmts

    @classmethod
    def object_is_serializable(cls, obj):
        try:
            format_handlers = cls.search(type(obj))
            return True
        except QuiltException as e:
            return False

    @classmethod
    def serialize(cls, obj, meta=None, ext=None, **format_opts):
        """Match an object to a format, and serialize it to that format.

        `obj`, `meta`, and `ext` are used to `search()` for a format handler.
        Then `obj` is serialized using that handler.  The resultant bytes and
        a dict for updating object metadata are returned.

        Args:
            obj: Object to serialize
            meta: Metadata (potentially) containing format info
            ext: File extension, if any
            **format_opts:
                Options specific to the format.  These are added to the
                format-specific metadata that is returned with the bytes of
                the serialized object.
        Raises:
            QuiltException: when an error is encountered obtaining the format
            Exception: Pass-through exceptions from serializers
        Returns: (bytes, dict)
            bytes: serialized object
            dict: format-specific metadata to be added to object metadata
        """
        handlers = cls.search(type(obj), meta, ext)
        assert isinstance(handlers[0], BaseFormatHandler)
        return handlers[0].serialize(obj, meta, ext, **format_opts)

    @classmethod
    def deserialize(cls, bytes_obj, meta=None, ext=None, as_type=None, **format_opts):
        """Deserialize `bytes_obj` using the given info

        `meta`, and `ext` are used to `search()` for format handlers, and
        that is filtered by `as_type` (if given).  The discovered handler is
        used to deserialize the given `bytes_obj`, and the deserialized object
        is returned.

        Args:
            bytes_obj: bytes to deserialize
            meta: Used to search for format handlers
            ext: Used to search for format handlers
            as_type: Used to filter format found handlers
            **format_opts:

        Returns:
            Deserialized object (type depends on deserializer)
        """
        if as_type:
            # Get handlers for meta and ext first.  obj_type is too strict to use here.
            handlers = cls.search(meta=meta, ext=ext)  # raises if no matches occur.
            handlers = [h for h in handlers if h.handles_type(as_type)]
            if not handlers:
                raise QuiltException(
                    "No matching handlers when limited to type {!r}".format(as_type)
                )
            handler = handlers[0]
        else:
            handler = cls.search(meta=meta, ext=ext)[0]
        return handler.deserialize(bytes_obj, meta, ext, **format_opts)

    @classmethod
    def for_format(cls, name):
        """Match a format handler by exact name."""
        if not name:
            return []
        matching_handlers = []
        for handler in cls.registered_handlers:
            if handler.name == name:
                matching_handlers.append(handler)
        return matching_handlers

    @classmethod
    def for_ext(cls, ext):
        """Match a format handler (or handlers) by extension."""
        if not ext:
            return []

        ext = ext.lower().strip('. ')
        matching_handlers = []

        for handler in cls.registered_handlers:
            if handler.handles_ext(ext):
                matching_handlers.append(handler)
        return matching_handlers

    @classmethod
    def for_type(cls, typ):
        """Match a format handler (or handlers) for a serializable type"""
        if typ is None:
            return []

        matching_handlers = []

        for handler in cls.registered_handlers:
            if handler.handles_type(typ):
                matching_handlers.append(handler)
        return matching_handlers

    @classmethod
    def for_obj(cls, obj):
        """Match a format handler (or handlers) for a serializable object"""
        return cls.for_type(type(obj))

    @classmethod
    def _get_name_from_meta(cls, meta):
        if not meta:
            return None
        name = meta.get('format', {}).get('name')
        # 'target': compat with older pkg structure -- can probably be removed soon.
        if not name:
            name = meta.get('target')
        return name

    @classmethod
    def for_meta(cls, meta):
        name = cls._get_name_from_meta(meta)
        return cls.for_format(name)

    @classmethod
    def all_supported_formats(cls):
        """
        Returns a map of supported object types -> serialization formats, e.g.:

                            Python Object Type     Serialization Formats
         <class 'pandas.core.frame.DataFrame'>  [ssv, csv, tsv, parquet]
                       <class 'numpy.ndarray'>                [npy, npz]
                                 <class 'str'>      [md, json, rst, txt]
                                <class 'dict'>                    [json]
                            <class 'NoneType'>                    [json]
                               <class 'tuple'>                    [json]
                                 <class 'int'>                    [json]
                                <class 'list'>                    [json]
                               <class 'float'>                    [json]
                               <class 'bytes'>                     [bin]
        """
        try:
            import numpy as np
        except ImportError:
            pass
        else:
            cls.search(np.ndarray)  # Force FormatHandlers to register np.ndarray as a supported object type

        try:
            import pandas as pd
        except ImportError:
            pass
        else:
            cls.search(pd.DataFrame)  # Force FormatHandlers to register pd.DataFrame as a supported object type

        type_map = defaultdict(set)
        for handler in cls.registered_handlers:
            for t in handler.handled_types:
                type_map[t].update(handler.handled_extensions)
        return dict(type_map)


class BaseFormatHandler(ABC):
    """Base class for binary format handlers
    """
    opts = ()
    name = None
    handled_extensions = ()
    handled_types = ()

    def __init__(self, name=None, handled_extensions=(), handled_types=()):
        """Common initialization for BaseFormat subclasses

        Subclasses implement the `serialize()` and `deserialize()` methods,
        which are passed the object/bytes to handle, as well as metadata and
        runtime kwargs.

        Subclasses *may* implement custom `handles_ext`, `handles_type` methods
        if there is a scenario which requires it (such as lazy load of a large
        module).

        Subclasses *may* define a class-level tuple named `opts`.  This tuple
        is used to name options that should be retained in metadata for the
        purpose of serialization/deserialization.  A subclass may process the
        options before using them, to vet them for security -- however, options
        which can potentially cause security issues should be avoided
        altogether.  `cls.opts` are useful to handle quirks in poorly-defined
        formats, such as CSV, TSV, and similar.

        Args:
            name(str): Name of new format.  Use existing name if your
                format is compatible with existing formats, if practicable.
                I.e., two different CSV format handlers should both use 'csv'.

            handled_extensions(iterable(str)): filename extensions that can be
                deserialized by this format

            handled_types(iterable(type)): types that can be serialized to
                (and deserialized from) by this format
        """
        self.name = name if name else self.name
        if not self.name:
            raise TypeError("No `name` attribute has been defined for {!r}".format(type(self).__name__))

        # add user extensions if given
        self.handled_extensions = set(ext.lstrip('.').lower() for ext in self.handled_extensions)
        self.handled_extensions.update(ext.lstrip('.').lower() for ext in handled_extensions)

        # add user types if given
        self.handled_types = set(self.handled_types) | set(handled_types)

    def handles_ext(self, ext):
        """Check if this format handles the filetype indicated by an extension

        Args:
            ext: extension to check

        Returns:
            bool
        """
        return ext.lstrip('.').lower() in self.handled_extensions

    def handles_type(self, typ):
        """Check if this format can serialize a given object.

        Args:
            obj: object to check

        Returns:
            bool
        """
        for handled_type in self.handled_types:
            if issubclass(typ, handled_type):
                return True
        return False

    def register(self):
        """Register this format for automatic usage

        Once registered, a format can be looked up by name, handled object
        types, and handled filetypes as indicated by extension.
        """
        FormatRegistry.register(self)

    def _update_meta(self, meta, additions=None):
        """Merge `additions` into a copy of `meta`, and returns the result.

        `additions` are recursively merged into `meta`.  If a .
        """
        additions = additions if additions else {}
        meta = copy.deepcopy(meta) if meta is not None else {}

        format_meta = meta.get('format', {})
        meta['format'] = format_meta   # in case default was used

        if additions:
            format_meta.update(additions)

        format_meta['name'] = self.name

        # compat -- remove once we stop using 'target' in other code.
        meta['target'] = self.name

        return meta

    @abstractmethod
    def serialize(self, obj, meta=None, ext=None, **format_opts):
        """Serialize an object using this format

        Args:
            obj: object to serialize
            meta: metadata to update
            **format_opts: Format options retained in metadata.  These are
                needed for some poorly-specified formats, like CSV.  If
                used in serialization, they are retained and used for
                deserialization.
        Returns:
            (bytes, dict):
                bytes: serialized object
                dict: metadata update
        """
        pass

    @abstractmethod
    def deserialize(self, bytes_obj, meta=None, ext=None, **format_opts):
        """Deserialize some bytes using this format

        Converts bytes into an object.

        If **kwargs is given, the kwargs are passed to the deserializer.

        Args:
            bytes_obj: bytes to deserialize
            meta: object metadata, may contain deserialization prefs
            ext: filename extension, if any
            **format_opts: Format options retained in metadata.  These are
                needed for some poorly-specified formats, like CSV.  If
                used in serialization, they are retained and used for
                deserialization.
        Returns:
            object
        """
        pass

    def __repr__(self):
        return "<{} {!r}, handling exts {} and types {}>".format(
            type(self).__name__,
            self.name,
            sorted(self.handled_extensions),
            sorted(t.__name__ for t in self.handled_types),
        )

    def get_opts(self, meta, user_opts=None):
        """Get options from format_opts or meta.

        This drops or rejects any options that are not named in self.opts.

        Args:
              user_opts(dict):  Format options from the user.  Used if given,
                and an error is raised for any invalid arguments.
              meta(dict):  Object metadata.  Used if user_opts is not given,
                and invalid options are dropped.
        """
        if user_opts is not None:
            opts = user_opts
        else:
            meta = meta if meta else {}
            opts = meta.get('format', {}).get('opts', {})
        allowed = set(self.opts)
        result = {}

        for name, value in opts.items():
            if name in allowed:
                result[name] = value
                continue
            else:
                # We don't want to raise here, because metadata or other
                # canned options can have invalid, irrelevant, or outdated
                # options.  F.e., if we do an R client, there may be an
                # R-specific option that gets stored.
                warnings.warn('Invalid option name {!r} (ignored)'.format(name))

        return copy.deepcopy(result)   # in case any values are mutable


class GenericFormatHandler(BaseFormatHandler):
    """Generic format for handling simple serializer/deserializer pairs

    This is a generic type that can be instantiated directly, passing in
    a 'serializer' and 'deserializer'.  See 'name' for the format name.
    """
    def __init__(self, name, handled_extensions, handled_types, serializer, deserializer):
        super().__init__(name, handled_extensions, handled_types)

        assert callable(serializer) and callable(deserializer)
        self._serializer, self._deserializer = serializer, deserializer

    def serialize(self, obj, meta=None, ext=None, **format_opts):
        """Pass `obj` to serializer and update `meta`, returning the result

        `meta` is only updated if serialization succeeds without error.

        Args:
            obj(object): object to serialize
            meta(dict): dict of associated metadata to update
            ext: File extension -- used f.e. when metadata is missing
            **format_opts: Format options retained in metadata.  These are
                needed for some poorly-specified formats, like CSV.  If
                used in serialization, they are retained and used for
                deserialization.
        Returns:
            bytes: encoded version of `obj`
        """
        data = self._serializer(obj)
        return data, self._update_meta(meta)

    def deserialize(self, bytes_obj, meta=None, ext=None, **format_opts):
        """Pass `bytes_obj` to deserializer and return the result

        Args:
            bytes_obj(bytes): bytes to deserialize
            meta(dict): ignored for GenericFormat formats
            **kwargs: passed directly to deserializer
        """
        return self._deserializer(bytes_obj)


GenericFormatHandler(
    'bytes',
    serializer=lambda obj: obj,
    deserializer=lambda bytes_obj: bytes_obj,
    handled_extensions=['bin'],
    handled_types=[bytes],
).register()


GenericFormatHandler(
    'json',
    serializer=lambda obj, **kwargs: json.dumps(obj, **kwargs).encode('utf-8'),
    deserializer=lambda bytes_obj, **kwargs: json.loads(bytes_obj.decode('utf-8'), **kwargs),
    handled_extensions=['json'],
    handled_types=[dict, list, int, float, str, tuple, type(None)]
).register()


# compatibility with prior code.  The 'utf-8' GenericFormat supersedes this,
# as it is loaded after this, but this is still present to decode existing stored objects.
GenericFormatHandler(
    'unicode',
    serializer=lambda s: s.encode('utf-8'),
    deserializer=lambda b: b.decode('utf-8'),
    handled_extensions=['txt', 'md', 'rst'],
    handled_types=[str],
).register()


GenericFormatHandler(
    'utf-8',  # utf-8 instead?
    serializer=lambda s: s.encode('utf-8'),
    deserializer=lambda b: b.decode('utf-8'),
    handled_extensions=['txt', 'md', 'rst'],
    handled_types=[str],
).register()


class CSVPandasFormatHandler(BaseFormatHandler):
    """Format for Pandas DataFrame <--> CSV formats

    Format Opts:
        The following options may be used anywhere format opts are accepted,
        or directly in metadata under `{'format': {'opts': {...: ...}}}`.

        doublequote(bool, default True): if quotechars are used, interpret two
            inside a field as a single quotechar element
        encoding(str): name of encoding used, default 'utf-8'
        escapechar(str length 1, default None):
            one-char string used to escape delimiter when quoting is "none"
        fieldsep(str): string that separates fields.
            serialization: default is ','
            deserialization: default is to detect automatically
        header_names(list):
            Use this if you want to store column names in metadata instead of
            in a header row.  To stop using these, you'll need to later set

            serializing: If headers are used, use these names instead of
                the DataFrame column names.
            deserializing: Use these names as the column names.
                If `use_header` is True: header is dropped
                If `use_header` is False: no header is read
                In either case, `header_names` will define the column names.
        index_names(list of str or int):
            If given, these are stored in Quilt metadata.  The names are used
            instead of existing/configured index column names (if any).

            serializing: The list must be the same length as the number of
                indexes.  Given names are used instead of DataFrame index
                names.
            deserializing:
                Default behavior:
                    The list length indicates the number of indexes.  The
                    names given are used for those indexes.
                Alternate behavior: See `index_names_are_keys`.
        index_names_are_keys(bool, default False):
            If True:
                When deserializing, `index_names` indicate column name or
                column index to use as index/multi-index (in order).  If the
                column name or index isn't present, deserialization fails.
            If False (default): When deserializing, index_names indicate the
                names to use for the first columns, and to use those columns
                as an index/multi-index.
        linesep(str):
            Line separator
        na_values(list of str): Default: ['', '#N/A', '#N/A N/A', '#NA',
                '-1.#IND', '-1.#QNAN', '-NaN', '-nan', '1.#IND', '1.#QNAN',
                'N/A', 'NA', 'NULL', 'NaN', 'n/a', 'nan', 'null']
            serialization:
                the first value is used to indicate a null/missing value. ''
                if not given.
            deserialization:
                The values given are treated as null/None.  If nothing is set,
                defaults are used.
        quotechar(str len 1):
            The character used to denote the beginning and end of a quoted
            item.
        quoting(str):
            Only useful when serializing.  Options are 'all', 'minimal',
            'none', and 'nonnumeric'.
        skip_spaces(bool):
            If True: Skip spaces immediately following fieldsep.
            If False (default): Treat spaces after fieldsep as data
        use_header(bool):
            If True (default):
                Include header when serializing, and expect one when
                deserializing.
            If False:
                Exclude header when serializing, and don't expect one when
                deserializing.
        use_index(bool):
            If True(default):
                Include indexes when serializing, and expect them when
                deserializing.
            If False:
                Exclude indexes when serializing, and don't expect them when
                deserializing.
    """
    name = 'csv'
    handled_extensions = ['csv', 'tsv', 'ssv']
    opts = ('doublequote', 'encoding', 'escapechar', 'fieldsep', 'header_names', 'index_names',
            'index_names_are_keys', 'linesep', 'na_values', 'quotechar', 'quoting', 'skip_spaces', 'use_header',
            'use_index')
    # defaults shouldn't be added to metadata, just used directly.
    defaults = {
        'encoding': 'utf-8',
        'index_names_are_keys': False,
        'na_values': [
            '', '#N/A', '#N/A N/A', '#NA',
            '-1.#IND', '-1.#QNAN', '-NaN', '-nan', '1.#IND', '1.#QNAN',
            'N/A', 'NA', 'NULL', 'NaN', 'n/a', 'nan', 'null'],
        'use_header': True,
        'use_index': False,
    }

    def handles_type(self, typ):
        # don't load pandas unless we actually have to use it..
        if 'pandas' not in sys.modules:
            return False
        import pandas as pd

        self.handled_types.add(pd.DataFrame)

        return super().handles_type(typ)

    def _quoting_opt_to_python(self, value):
        if isinstance(value, int):
            return value
        elif isinstance(value, str):
            value = value.strip().lower()
            map = {
                'all': csv.QUOTE_ALL,
                'minimal': csv.QUOTE_MINIMAL,
                'none': csv.QUOTE_NONE,
                'nonnumeric': csv.QUOTE_NONNUMERIC
            }
            return map.get(value, NOT_SET)
        warnings.warn("Unrecognized value for 'quoting' option: {!r} (ignored)".format(value))
        return NOT_SET

    def get_ser_kwargs(self, opts):
        opts = copy.deepcopy(opts)
        result_kwargs = {}

        # interdependent opts, can't be processed individually.
        use_header = opts.pop('use_header')    # must exist, at least as a default
        header_names = opts.pop('header_names', None)
        if use_header:
            result_kwargs['header'] = header_names if header_names else True
        else:
            result_kwargs['header'] = False

        # No kwarg correlate for serialization
        opts.pop('index_names_are_keys', None)

        name_map = {
            'fieldsep': 'sep',
            'linesep': 'line_terminator',
            'use_index': 'index',
            'index_names': 'index_label',
        }
        for name, value in opts.items():
            if name in name_map:
                result_kwargs[name_map[name]] = value
            elif name == 'quoting':
                value = self._quoting_opt_to_python(value)
                if value is NOT_SET:
                    continue
                result_kwargs[name] = value
                continue
            elif name == 'na_values':
                result_kwargs['na_rep'] = value[0]
            else:
                # exact match / pass through arg
                result_kwargs[name] = value

        return result_kwargs

    def serialize(self, obj, meta=None, ext=None, **format_opts):
        opts = self.get_opts(meta, format_opts)

        default_opts = copy.deepcopy(self.defaults)

        # CSVs should be the same regardless of the OS.
        # This can't be in self.defaults, though, because we don't want it when deserializing.
        default_opts['linesep'] = '\n'

        # Use the default delimiter for the given extension, if no fieldsep was specified.
        if ext and 'fieldsep' not in opts:
            ext = ext.strip().lstrip('.').lower()
            ext_map = {'csv': ',', 'tsv': '\t', 'ssv': ';'}
            if ext in ext_map:
                default_opts['fieldsep'] = ext_map[ext]
        opts_with_defaults = default_opts
        opts_with_defaults.update(opts)

        # interdependent opts, can't be processed individually.
        # Does nothing during serialization, but we should check it at least makes sense.
        index_names_are_keys = opts_with_defaults.get('index_names_are_keys')
        if index_names_are_keys:
            if 'index_names' not in opts:
                raise QuiltException(
                    "Format option 'index_names_are_keys' is set, but 'index_names' not given."
                )
            elif not len(opts['index_names']) == len(obj.index.names):
                raise ValueError(
                    "{} entries in `index_names`, but the DataFrame to be serialized has {} indexes"
                    .format(len(opts['index_names']), len(obj.index.names))
                )

        kwargs = self.get_ser_kwargs(opts_with_defaults)
        buf = io.BytesIO()

        # pandas bug workaround -- see _WriteEncodingWrapper definition
        encoded_buf = self._WriteEncodingWrapper(buf, encoding=kwargs['encoding'])
        obj.to_csv(encoded_buf, **kwargs)

        return buf.getvalue(), self._update_meta(meta, additions={'opts': opts_with_defaults})

    def get_des_kwargs(self, opts):
        opts = copy.deepcopy(opts)
        result_kwargs = {}

        # Interdependent opts.
        header_names = opts.pop('header_names', None)
        use_header = opts.pop('use_header')  # opt should be present from defaults.
        if use_header:
            result_kwargs['header'] = 0
            if header_names:
                result_kwargs['names'] = header_names
        else:
            result_kwargs['header'] = None
            result_kwargs['names'] = header_names

        # Interdependent opts.
        index_names = opts.pop('index_names', None)
        use_index = opts.pop('use_index')   # opt should be present from defaults.
        index_names_are_keys = opts.pop('index_names_are_keys', False)
        if use_index:
            if index_names:
                if index_names_are_keys:
                    result_kwargs['index_col'] = index_names
                else:
                    result_kwargs['index_col'] = list(range(len(index_names)))
            else:
                result_kwargs['index_col'] = [0]
        else:
            result_kwargs['index_col'] = False

        # map names to pandas `df.to_csv() args`
        name_map = {
            'fieldsep': 'sep',
            'linesep': 'lineterminator',
        }
        for name, value in opts.items():
            if name == 'quoting':
                result_kwargs[name] = self._quoting_opt_to_python(value)
            elif name in name_map:
                result_kwargs[name_map[name]] = value
            else:
                # exact match / passthrough arg
                result_kwargs[name] = value

        return result_kwargs

    def deserialize(self, bytes_obj, meta=None, ext=None, **format_opts):
        import pandas as pd  # large import / lazy

        opts = self.get_opts(meta, format_opts)
        default_opts = copy.deepcopy(self.defaults)

        # Use the default delimiter for the given extension, if no fieldsep was specified.
        if ext and 'fieldsep' not in opts:
            ext = ext.strip().lstrip('.').lower()
            ext_map = {'csv': ',', 'tsv': '\t', 'ssv': ';'}
            if ext in ext_map:
                default_opts['fieldsep'] = ext_map[ext]
        opts_with_defaults = default_opts
        opts_with_defaults.update(opts)

        kwargs = self.get_des_kwargs(opts_with_defaults)
        df = pd.read_csv(io.BytesIO(bytes_obj), **kwargs)

        index_names = opts_with_defaults.get('index_names')
        index_names_are_keys = opts_with_defaults.get('index_names_are_keys')
        if index_names and not index_names_are_keys:
            # this particular config isn't handled directly by Pandas read_csv, but
            # is an inverse of a Pandas to_csv() option state.
            df.rename_axis(index_names, inplace=True)

        return df

    class _WriteEncodingWrapper:
        # Pandas bug https://github.com/pandas-dev/pandas/issues/23854
        # pandas ignores encoding when writing to io buffers (including files open as 'wb').
        # this results in Pandas trying to write a string into a bytes buffer (and failing)
        # Using this class, we can avoid keeping an additional copy of the data in memory,
        # as otherwise we'd have the DataFrame, the string, and the bytes.
        def __init__(self, bytes_filelike, encoding='utf-8'):
            self.bytes_filelike = bytes_filelike
            self.encoding = encoding

        def __getattr__(self, item):
            return getattr(self.bytes_filelike, item)

        def write(self, string):
            self.bytes_filelike.write(string.encode(self.encoding))

        def writelines(self, lines):
            # function scope import, but this is a bug workaround for pandas.
            from codecs import iterencode
            encoded_lines = iterencode(lines, self.encoding)
            self.bytes_filelike.writelines(encoded_lines)


CSVPandasFormatHandler().register()


class NumpyFormatHandler(BaseFormatHandler):
    name = 'numpy'
    handled_extensions = ['npy', 'npz']

    def handles_type(self, typ):
        # If this is a numpy object, numpy must be loaded.
        if 'numpy' not in sys.modules:
            return False
        import numpy as np
        self.handled_types.add(np.ndarray)
        return super().handles_type(typ)

    def serialize(self, obj, meta=None, ext=None, **format_opts):
        import numpy as np
        buf = io.BytesIO()

        # security
        kwargs = dict(allow_pickle=False)

        np.save(buf, obj, **kwargs)
        return buf.getvalue(), self._update_meta(meta)

    def deserialize(self, bytes_obj, meta=None, ext=None, **format_opts):
        try:
            import numpy as np
        except ImportError:
            raise QuiltException("Please install numpy")

        # security
        kwargs = dict(allow_pickle=False)

        buf = io.BytesIO(bytes_obj)
        return np.load(buf, **kwargs)


NumpyFormatHandler().register()


# noinspection PyPackageRequirements
class ParquetFormatHandler(BaseFormatHandler):
    """Format for Pandas DF <--> Parquet

    Format Opts:
        The following options may be used anywhere format opts are accepted,
        or directly in metadata under `{'format': {'opts': {...: ...}}}`.

        compression(string or dict):  applies during serialization only.
            If a string is given, and string ends in "_columns":
                Use the first part of the string as the compression format for
                each column.
            Otherwise:
                pass-through to the `pyarrow.parquet.write_table()`
    """
    name = 'parquet'
    handled_extensions = ['parquet']
    opts = ('compression',)
    defaults = {
        'compression': 'snappy',
    }

    def handles_type(self, typ):
        # don't load pyarrow or pandas unless we actually have to use them..
        if 'pandas' not in sys.modules:
            return False
        import pandas as pd
        try:
            # intentional unused import -- verify we have pyarrow installed
            import pyarrow as pa  # pylint: disable=unused-import
        except ImportError:
            return False
        self.handled_types.add(pd.DataFrame)
        return super().handles_type(typ)

    def serialize(self, obj, meta=None, ext=None, **format_opts):
        import pyarrow as pa
        from pyarrow import parquet

        opts = self.get_opts(meta, format_opts)
        opts_with_defaults = copy.deepcopy(self.defaults)
        opts_with_defaults.update(opts)
        table = pa.Table.from_pandas(obj)
        buf = io.BytesIO()
        parquet.write_table(table, buf, **opts_with_defaults)

        return buf.getvalue(), self._update_meta(meta, additions=opts_with_defaults)

    def deserialize(self, bytes_obj, meta=None, ext=None, **format_opts):
        try:
            import pyarrow as pa
            from pyarrow import parquet
        except ImportError:
            raise QuiltException("Please install pyarrow")

        buf = io.BytesIO(bytes_obj)
        table = parquet.read_table(buf)
        try:
            obj = pa.Table.to_pandas(table)
        except (AssertionError, KeyError):
            # Try again to convert the table after removing
            # the possibly buggy Pandas-specific metadata.
            meta = table.schema.metadata.copy()
            meta.pop(b'pandas')
            newtable = table.replace_schema_metadata(meta)
            obj = newtable.to_pandas()
        return obj


# compat -- also handle 'pyarrow' in meta['target'] and meta['format']['name'].
ParquetFormatHandler('pyarrow').register()
ParquetFormatHandler().register()  # latest is preferred
