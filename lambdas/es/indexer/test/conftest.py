# PRE: you must do the following for this test to work
# aws s3 cp s3://amazon-reviews-pds/parquet/ ./data/amazon-reviews-pds/parquet/ --recursive
def pytest_addoption(parser):
    parser.addoption(
        '--extended',
        action='store_true',
        dest='extended',
        default=False,
        help="enable longrundecorated tests"
    )

def pytest_configure(config):
    if not config.option.extended:
        setattr(config.option, 'markexpr', 'not extended')
