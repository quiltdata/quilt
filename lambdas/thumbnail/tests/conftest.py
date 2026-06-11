import pytest

import quilt3.session
import quilt3.util


def pytest_addoption(parser):
    parser.addoption(
        '--poppler',
        action='store_true',
        dest='poppler',
        default=False,
        help="Indicates poppler tools (incl. pdftoppm) installed"
    )
    parser.addoption(
        '--loffice',
        action='store_true',
        dest='loffice',
        default=False,
        help="Indicates LibreOffice installed"
    )
    parser.addoption(
        "--large-files",
        action="store_true",
        dest="large_files",
        default=False,
        help="Enable tests that use large files",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "poppler: mark a test to run only if --poppler is indicated (poppler tools is installed)"
    )
    config.addinivalue_line(
        "markers", "loffice: mark a test to run only if --loffice is indicated (LibreOffice is installed)"
    )

    markers_to_exclude = []

    if not config.option.poppler:
        markers_to_exclude.append('poppler')

    if not config.option.loffice:
        markers_to_exclude.append('loffice')

    config.option.markexpr = ' and '.join([f'not {m}' for m in markers_to_exclude])


@pytest.fixture(scope="session", autouse=True)
def isolated_quilt3_state(tmp_path_factory):
    # Make quilt3 behave as if never logged in: a stale `quilt3 login` against
    # an unreachable catalog otherwise replaces the whole AWS credential chain
    # (quilt3.session.create_botocore_session) and breaks the package-based
    # tests with DNS/auth errors before any S3 request is made.
    base = tmp_path_factory.mktemp("quilt3-state")
    mp = pytest.MonkeyPatch()
    mp.setattr(quilt3.session, "AUTH_PATH", base / "auth.json")
    mp.setattr(quilt3.session, "CREDENTIALS_PATH", base / "credentials.json")
    mp.setattr(quilt3.util, "CONFIG_PATH", base / "config.yml")
    yield
    mp.undo()


@pytest.fixture(scope="function", autouse=True)
def disable_tmp_dir_cleanup(mocker):
    # It's already supposed to be disabled by default in test environment,
    # but just in case, we explicitly mock out the cleanup function here.
    mocker.patch("t4_lambda_thumbnail.clean_tmp_dir")
