import tempfile
from pathlib import Path
from unittest import mock

import quilt3
from quilt3 import main

from .utils import QuiltTestCase


create_parser = main.create_parser

class CommandLineTestCase(QuiltTestCase):
    """
    Base TestCase class, sets up a CLI parser
    """
    @classmethod
    def setUpClass(cls):
        parser = create_parser()
        cls.parser = parser

class QuiltCLITestCase(CommandLineTestCase):
    def test_quilt_config(self):
        args = self.parser.parse_args(['config', 'https://foo.bar'])
        assert args.catalog_url == 'https://foo.bar'

    def test_push(self):
        name = 'test/name'
        pkg = quilt3.Package()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (Path(tmp_dir) / 'foo').touch()
            (Path(tmp_dir) / 'bar').mkdir()
            (Path(tmp_dir) / 'bar' / 'baz')

            with mock.patch('quilt3.Package.__new__', return_value=pkg) as mocked_package_class, \
                 mock.patch.object(pkg, 'set_dir', wraps=pkg.set_dir) as mocked_set_dir, \
                 mock.patch.object(pkg, 'push') as mocked_push:
                main.main(('push', '--dir', tmp_dir, name))

                mocked_package_class.assert_called_once_with(quilt3.Package)
                mocked_set_dir.assert_called_once_with('.', tmp_dir)
                mocked_push.assert_called_once_with(name, registry=None, dest=None, message=None)
