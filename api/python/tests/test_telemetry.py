import unittest
from unittest import mock

from quilt3.telemetry import ApiTelemetry


@ApiTelemetry(mock.sentinel.API_NAME1)
def test_api_function1():
    pass


@ApiTelemetry(mock.sentinel.API_NAME2)
def test_api_function2():
    pass


class TelemetryTest(unittest.TestCase):
    def setUp(self):
        super().setUp()

        patcher = mock.patch('quilt3.telemetry.ApiTelemetry.report_api_use')
        self.mock_report_api_use = patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch('quilt3.telemetry.ApiTelemetry.telemetry_disabled', False)
    def test_session_id(self):
        """
        Session ID stays the same across the calls.
        """
        test_api_function1()
        self.mock_report_api_use.assert_called_once_with(mock.sentinel.API_NAME1, mock.ANY)
        session_id = self.mock_report_api_use.call_args[0][1]

        self.mock_report_api_use.reset_mock()
        test_api_function2()
        self.mock_report_api_use.assert_called_once_with(mock.sentinel.API_NAME2, session_id)
