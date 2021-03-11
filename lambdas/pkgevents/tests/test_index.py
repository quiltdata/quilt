import pytest

from index import pkg_created_event


@pytest.mark.parametrize(
    'key',
    (
        ''
        'a',
        '.quilt'
        '.quilt/named_packages',
        '.quilt/named_packages/a',
        '.quilt/named_packages/a/b',
        '.quilt/named_packages/a/b/1451631599',
        '.quilt/named_packages/a/b/1767250801',
    )
)
def test_pkg_created_event_bad_key(key):
    assert pkg_created_event({
        'eventName': 'ObjectCreated:Put',
        's3': {
            'object': {
                'key': key,
            }
        }
    }) is None
