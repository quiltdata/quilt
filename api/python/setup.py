import os
import sys

from pathlib import Path

from setuptools import setup, find_packages
from setuptools.command.install import install

VERSION = Path(Path(__file__).parent, "quilt3", "VERSION").read_text()

def readme():
    readme_short = """
    Quilt is a data management tool designed for data discoverability, data dependency
    management, and data version control using `data packages <https://blog.quiltdata.com/data-packages-for-fast-reproducible-python-analysis-c74b78015c7f>`_.

    The `quilt3` PyPi package allows you to build, push, and install data packages in Quilt using Python.
    Visit the `documentation quickstart <https://docs.quiltdata.com/quickstart>`_ for more information.

    """
    return readme_short

class VerifyVersionCommand(install):
    """Custom command to verify that the git tag matches our version"""
    description = 'verify that the git tag matches our version'

    def run(self):
        tag = os.getenv('CIRCLE_TAG')

        if tag != VERSION:
            info = "Git tag: {0} does not match the version of this app: {1}".format(
                tag, VERSION
            )
            sys.exit(info)

setup(
    name="quilt3",
    version=VERSION,
    packages=find_packages(),
    description='Quilt: where data comes together',
    long_description=readme(),
    python_requires='>=3.6',
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
    ],
    author='quiltdata',
    author_email='contact@quiltdata.io',
    license='LICENSE',
    url='https://github.com/quiltdata/quilt',
    keywords='',
    install_requires=[
        'appdirs>=1.4.0',
        'aws-requests-auth>=0.4.2',
        'boto3>=1.8.0',
        'jsonlines==1.2.0',
        'packaging>=16.8',
        'python-dateutil<=2.8.0',           # 2.8.1 conflicts with botocore
        'requests>=2.12.4',
        'ruamel.yaml>=0.15.78',
        'tqdm>=4.26.0',
        'urllib3<1.25,>=1.21.1',            # required by requests
        'requests_futures==1.0.0',
    ],
    extras_require={
        'pyarrow': [
            'numpy>=1.14.0',                    # required by pandas, but missing from its dependencies.
            'pandas>=0.19.2',
            'pyarrow>=0.14.1',                  # as of 7/5/19: linux/circleci bugs on 0.14.0
        ],
        'tests': [
            'codecov',
            'numpy>=1.14.0',                    # required by pandas, but missing from its dependencies.
            'pandas>=0.19.2',
            'pyarrow>=0.14.1',                  # as of 7/5/19: linux/circleci bugs on 0.14.0
            'pytest<5.1.0',  # TODO: Fix pytest.ensuretemp in conftest.py
            'pytest-cov',
            'responses',
            'tox',
            'detox',
            'tox-pytest-summary',
        ],
    },
    include_package_data=True,
    entry_points={
        'console_scripts': ['quilt3=quilt3.main:main'],
    },
    cmdclass={
        'verify': VerifyVersionCommand,
    }
)
