import click 
import sys

from quilt3 import check_packages, config

@click.command()
@click.argument('pkg_names') # open-data-registry/datasets
def run_tests_on_packages(pkg_names):
    sys.exit(check_packages([pkg_names], registry='s3://quilt-example')) # pylint: disable=no-value-for-parameter#set by click

if __name__ == '__main__':
    config('https://open.quiltdata.com')
    run_tests_on_packages() # pylint: disable=no-value-for-parameter#set by click