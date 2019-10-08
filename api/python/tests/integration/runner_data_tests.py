import click 

from quilt3 import check_packages

@click.command()
@click.argument('pkg_names') # open-data-registry/datasets
def run_tests_on_packages(pkg_names):
    check_packages(pkg_names) # pylint: disable=no-value-for-parameter#set by click

if __name__ == "__main__":
    run_tests_on_packages() # pylint: disable=no-value-for-parameter#set by click