import os
import sys
from pathlib import Path

from setuptools import find_packages, setup
from setuptools.command.install import install

VERSION = Path(Path(__file__).parent, "quilt3", "VERSION").read_text().strip()


def readme():
    return """\
Quilt manages data like code (with packages, repositories, browsing and
revision history) so that teams can experiment faster in machine learning,
biotech, and other data-driven domains.

The `quilt3` PyPI package allows you to build, push, and install data packages.
Visit the `documentation quickstart <https://docs.quiltdata.com/quickstart>`_
to learn more.
"""


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
    packages=find_packages(exclude=("tests", "tests.*")),
    description='Quilt: where data comes together',
    long_description=readme(),
    python_requires='>=3.7',
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
    ],
    author='quiltdata',
    author_email='contact@quiltdata.io',
    license='Apache-2.0',
    url='https://github.com/quiltdata/quilt',
    keywords='',
    install_requires=[
        'platformdirs>=2',
        'aws-requests-auth>=0.4.2',
        'boto3>=1.10.0',
        'jsonlines==1.2.0',
        'PyYAML>=5.1',
        'requests>=2.12.4',
        'tenacity>=5.1.1',
        'tqdm>=4.32',
        'requests_futures==1.0.0',
        'jsonschema>=3,<5',
        'importlib_metadata; python_version < "3.8"',
    ],
    extras_require={
        'pyarrow': [
            'numpy>=1.14.0',                # required by pandas, but missing from its dependencies.
            'pandas>=0.19.2',
            'pyarrow>=0.14.1',              # as of 7/5/19: linux/circleci bugs on 0.14.0
        ],
        'tests': [
            'numpy>=1.14.0',                # required by pandas, but missing from its dependencies.
            'pandas>=0.19.2',
            'pyarrow>=0.14.1',              # as of 7/5/19: linux/circleci bugs on 0.14.0
            'pytest==6.*',
            'pytest-cov',
            'coverage==6.4',
            'pytest-env',
            'pytest-subtests',
            'responses',
            'git-pylint-commit-hook',
        ],
        'catalog': [
            'quilt3_local>=1,<2',
            'uvicorn>=0.15,<0.18',
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
