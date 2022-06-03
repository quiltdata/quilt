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

    setattr(
        config.option,
        'markexpr',
        ' and '.join([f'not {m}' for m in markers_to_exclude])
    )
