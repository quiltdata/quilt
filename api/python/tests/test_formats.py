import pathlib

import numpy as np
import pandas as pd
import pytest

from quilt3.formats import FormatRegistry
from quilt3.util import QuiltException

# Constants


# Code
def test_buggy_parquet():
    """
    Test that Quilt avoids crashing on bad Pandas metadata from
    old pyarrow libaries.
    """
    path = pathlib.Path(__file__).parent
    for parquet_handler in FormatRegistry.for_format('parquet'):
        with open(path / 'data' / 'buggy_parquet.parquet', 'rb') as bad_parq:
            # Make sure this doesn't crash.
            parquet_handler.deserialize(bad_parq.read())


def test_formats_for_obj():
    arr = np.ndarray(3)

    fmt = FormatRegistry.for_obj(arr)[0]

    assert 'npz' in fmt.handled_extensions
    assert FormatRegistry.for_ext('npy')[0] is fmt

    expected_string_fmt_names = ['utf-8', 'unicode', 'json']
    found_string_fmt_names = list(f.name for f in FormatRegistry.for_obj('blah'))
    assert found_string_fmt_names == expected_string_fmt_names

    bytes_obj = fmt.serialize(arr)[0]
    np.testing.assert_array_equal(fmt.deserialize(bytes_obj), arr)


def test_formats_for_ext():
    fmt = FormatRegistry.for_ext('json')[0]
    assert fmt.serialize({'blah': 'blah'})[0] == b'{"blah": "blah"}'
    assert fmt.deserialize(b'{"meow": "mix"}', ) == {'meow': 'mix'}


def test_formats_for_meta():
    bytes_fmt = FormatRegistry.for_meta({'target': 'bytes'})[0]
    json_fmt = FormatRegistry.for_meta({'target': 'json'})[0]

    some_bytes = b'["phlipper", "piglet"]'
    assert bytes_fmt.serialize(some_bytes)[0] == some_bytes
    assert json_fmt.deserialize(some_bytes) == ['phlipper', 'piglet']


def test_formats_for_format():
    bytes_fmt = FormatRegistry.for_format('bytes')[0]
    json_fmt = FormatRegistry.for_format('json')[0]

    some_bytes = b'["phlipper", "piglet"]'
    assert bytes_fmt.serialize(some_bytes)[0] == some_bytes
    assert json_fmt.deserialize(some_bytes) == ['phlipper', 'piglet']


def test_formats_serdes():
    objects = [
        {'blah': 'foo'},
        b'blather',
        'blip',
    ]
    metadata = [{} for o in objects]

    for obj, meta in zip(objects, metadata):
        data, format_meta = FormatRegistry.serialize(obj, meta)
        meta.update(format_meta)
        assert FormatRegistry.deserialize(data, meta) == obj

    meta = {}
    df1 = pd.DataFrame([[1, 2], [3, 4]])
    data, format_meta = FormatRegistry.serialize(df1, meta)
    meta.update(format_meta)
    df2 = FormatRegistry.deserialize(data, meta)

    # we can't really get around this nicely -- if header is used, and header names are numeric,
    # once loaded from CSV, header names are now strings.  This causes a bad comparison, so we
    # cast to int again.
    df2.columns = df2.columns.astype(int, copy=False)

    assert df1.equals(df2)


def test_formats_csv_read():
    csv_file = pathlib.Path(__file__).parent / 'data' / 'csv.csv'

    meta = {'format': {'name': 'csv'}}
    expected_bytes = b'a,b,c,d\n1,2,3,4\n5,6,7,8\n'
    expected_df = FormatRegistry.deserialize(expected_bytes, meta)
    df = FormatRegistry.deserialize(csv_file.read_bytes(), meta)

    assert df.equals(expected_df)
    assert expected_bytes == FormatRegistry.serialize(df, meta)[0]


def test_formats_csv_roundtrip():
    test_data = b'9,2,5\n7,2,6\n1,0,1\n'

    # roundtrip defaults.
    meta = {'format': {'name': 'csv'}}
    df1 = FormatRegistry.deserialize(test_data, meta)
    bin, format_meta = FormatRegistry.serialize(df1, meta)
    meta.update(format_meta)
    df2 = FormatRegistry.deserialize(bin, meta)

    assert test_data == bin
    assert df1.equals(df2)

    # interpret first row as header
    meta = {'format': {'name': 'csv', 'opts': {'use_header': True}}}
    df1 = FormatRegistry.deserialize(test_data, meta)
    bin, format_meta = FormatRegistry.serialize(df1, meta)
    meta.update(format_meta)
    df2 = FormatRegistry.deserialize(bin, meta)

    assert test_data == bin
    assert df1.equals(df2)

    # interpret first column as index
    meta = {'format': {'name': 'csv', 'opts': {'use_index': True}}}
    df1 = FormatRegistry.deserialize(test_data, meta)
    bin, format_meta = FormatRegistry.serialize(df1, meta)
    meta.update(format_meta)
    df2 = FormatRegistry.deserialize(bin, meta)

    assert test_data == bin
    assert df1.equals(df2)

    # interpret first row as header, and first column as index
    meta = {'format': {'name': 'csv', 'opts': {'use_index': True, 'use_header': True}}}
    df1 = FormatRegistry.deserialize(test_data, meta)
    bin, format_meta = FormatRegistry.serialize(df1, meta)
    meta.update(format_meta)
    df2 = FormatRegistry.deserialize(bin, meta)

    assert test_data == bin
    assert df1.equals(df2)


def test_formats_search_fail_notfound():
    # a search that finds nothing should raise with an explanation.
    class Foo:
        pass

    bad_kwargs = [
        dict(obj_type=Foo, meta=None, ext=None),
        dict(obj_type=None, meta={}, ext=None),
        dict(obj_type=None, meta=None, ext='.fizz'),
    ]

    for args in bad_kwargs:
        with pytest.raises(QuiltException):
            FormatRegistry.search(**args)


def test_formats_search_order():
    # String is nice and easy to work with for this test
    utf8_meta = {'format': {'name': 'utf-8'}}
    unicode_meta = {'format': {'name': 'unicode'}}  # just compat with older 'unicode'
    json_meta = {'format': {'name': 'json'}}

    # pd.DataFrame can be serialized to a few formats.
    utf8_handler = FormatRegistry.search(obj_type=str, meta=utf8_meta)[0]
    unicode_handler = FormatRegistry.search(obj_type=str, meta=unicode_meta)[0]
    json_handler = FormatRegistry.search(obj_type=str, meta=json_meta)[0]

    # FormatRegistry.search(), all other things being equal,
    # should return the most-recently-registered format first.
    utf8_handler.register()
    assert FormatRegistry.search(obj_type=str)[0] is utf8_handler
    unicode_handler.register()
    assert FormatRegistry.search(obj_type=str)[0] is unicode_handler
    json_handler.register()
    assert FormatRegistry.search(obj_type=str)[0] is json_handler
    utf8_handler.register()
    assert FormatRegistry.search(obj_type=str)[0] is utf8_handler

    # FormatRegistry.search() should not *exclude* by extension, because
    # users could make files like "data.monday" or whatever.
    # However, it should *prioritize* by extension.
    #
    # From the above section, utf8_handler is formats[0].
    formats = FormatRegistry.search(obj_type=str, ext='.json')
    assert utf8_handler in formats
    assert unicode_handler in formats
    assert formats[0] is json_handler
