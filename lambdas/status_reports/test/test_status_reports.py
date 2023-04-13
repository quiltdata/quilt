import unittest
import asyncio

import src.t4_lambda_status_reports as status_reports


class TestStatusReports(unittest.TestCase):
    """
    Unit tests for the status_reports lambda
    """

    def test_lambda_handler(self):
        """
        Stub test: ensure the lambda code is installed and can be imported
        """
        assert status_reports.lambda_handler

    async def test_lambda_status_reports(self):
        """
        Stub test: generate a status report
        """
        assert asyncio.run(status_reports.generate_status_report('t4-lambda-canaries'))
