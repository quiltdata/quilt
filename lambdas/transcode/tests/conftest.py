def pytest_addoption(parser):
    parser.addoption(
        '--poppler',
        action='store_true',
        dest='poppler',
        default=False,
        help="Indicates poppler tools (incl. pdftoppm) installed"
    )


def pytest_configure(config):
    if not config.option.poppler:
        setattr(config.option, 'markexpr', 'not poppler')
