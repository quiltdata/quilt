import inspect
import unittest
from unittest import mock

import quilt3
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

    def test_session_reset_session_id(self):
        test_api_function1()
        self.mock_report_api_use.assert_called_once_with(mock.sentinel.API_NAME1, mock.ANY)
        session_id = self.mock_report_api_use.call_args[0][1]

        self.mock_report_api_use.reset_mock()
        quilt3.telemetry.reset_session_id()
        test_api_function2()
        self.mock_report_api_use.assert_called_once_with(mock.sentinel.API_NAME2, mock.ANY)
        new_session_id = self.mock_report_api_use.call_args[0][1]

        assert new_session_id != session_id

    def test_preserves_signature(self):
        """
        The decorator exposes the wrapped function's signature to
        inspect.signature(). Note this passes even without the fix, since
        inspect.signature() follows __wrapped__ by default; see
        test_signature_does_not_require_following_wrapped for the real guard.
        """

        def func(a, b, c=1, *, d=2):
            pass

        decorated = ApiTelemetry(mock.sentinel.API_NAME)(func)
        assert inspect.signature(decorated) == inspect.signature(func)

    def test_signature_does_not_require_following_wrapped(self):
        """
        Regression guard for the real fix. ``functools.wraps`` only sets
        ``__wrapped__``, so ``inspect.signature()`` recovers the original
        parameters *only* when it follows that chain. The explicit
        ``__signature__`` assignment is what makes the signature resolvable
        without following ``__wrapped__`` — the path pydoc-markdown's gendocs
        build takes for ``@classmethod``-wrapped APIs like ``Package.install``.

        Without the fix this asserts ``(*args, **kwargs)``; with it, the real
        signature. (The default ``follow_wrapped=True`` masks the bug, which
        is why the test above passes either way.)
        """

        def func(a, b, c=1, *, d=2):
            pass

        decorated = ApiTelemetry(mock.sentinel.API_NAME)(func)
        assert inspect.signature(decorated, follow_wrapped=False) == inspect.signature(func)

    def test_unintrospectable_signature(self):
        """
        When the wrapped function's signature can't be introspected, the
        decorator swallows the error and returns a working callable that
        simply doesn't expose an explicit __signature__.
        """

        def func():
            pass

        with mock.patch('quilt3.telemetry.inspect.signature', side_effect=ValueError):
            decorated = ApiTelemetry(mock.sentinel.API_NAME)(func)

        assert not hasattr(decorated, '__signature__')
        decorated()
        self.mock_report_api_use.assert_called_once_with(mock.sentinel.API_NAME, mock.ANY)
