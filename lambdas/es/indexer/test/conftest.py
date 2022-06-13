import os


# PRE: you must populate data/extended with (.parquet) data
# e.g. aws s3 cp s3://amazon-reviews-pds/parquet/ ./data/amazon-reviews-pds/parquet/ --recursive
def pytest_addoption(parser):
    parser.addoption(
        '--extended',
        action='store_true',
        dest='extended',
        default=False,
        help="enable extended decorated tests"
    )


def pytest_configure(config):
    if not config.option.extended:
        setattr(config.option, 'markexpr', 'not extended')
    os.environ['DOC_LIMIT_BYTES'] = '10000'
    os.environ['CONTENT_INDEX_EXTS'] = '.csv, .md, .parquet, .rmd, .tsv, .txt, .ipynb, .json'
    os.environ['SKIP_ROWS_EXTS'] = ''
