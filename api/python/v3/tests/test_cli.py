from t4 import main

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

class T4CLITestCase(CommandLineTestCase):
    def test_t4_config(self):
        args = self.parser.parse_args(['config', 'https://foo.bar'])
        assert args.catalog_url == 'https://foo.bar'
