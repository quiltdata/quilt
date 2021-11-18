import hashlib
import io
import unittest
from unittest import mock

import index


class S3HashTest(unittest.TestCase):
    @mock.patch.object(index, 'urlopen')
    def test(self, urlopen_mock):
        test_url = 'https://example.com'
        test_data = b'blah'
        urlopen_mock.return_value = io.BytesIO(test_data)

        assert index.lambda_handler(test_url, mock.MagicMock()) == hashlib.sha256(test_data).hexdigest()
        urlopen_mock.assert_called_once_with(test_url)
        assert urlopen_mock.return_value.closed
