import os
import sys

from pathlib import Path

from setuptools import setup, find_packages
from setuptools.command.install import install

VERSION = Path(Path(__file__).parent, "quilt3", "VERSION").read_text().strip()

def readme():
    readme_short = """
    Quilt manages data like code (with packages, repositories, browsing and
    revision history) so that teams can experiment faster in machine learning,
    biotech, and other data-driven domains.

    The `quilt3` PyPi package allows you to build, push, and install data packages.
    Visit the `documentation quickstart <https://docs.quiltdata.com/quickstart>`_
    to learn more.
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
        'Programming Language :: Python :: 3.8',
    ],
    author='quiltdata',
    author_email='contact@quiltdata.io',
    license='LICENSE',
    url='https://github.com/quiltdata/quilt',
    keywords='',
    install_requires=[
        'appdirs>=1.4.0',
        'aws-requests-auth>=0.4.2',
        'boto3>=1.10.0',
        'dnspython>=1.16.0',
        'flask',
        'flask_cors',
        'flask_json',
        'jsonlines==1.2.0',
        'packaging>=16.8',
        'python-dateutil<=2.8.0',           # 2.8.1 conflicts with botocore
        'PyYAML>=5.3',
        'requests>=2.12.4',
        'tenacity>=5.1.1',
        'tqdm>=4.26.0',
        'urllib3<1.25,>=1.21.1',            # required by requests
        'requests_futures==1.0.0',
    ],
    extras_require={
        'pyarrow': [
            'numpy>=1.14.0',                # required by pandas, but missing from its dependencies.
            'pandas>=0.19.2',
            'pyarrow>=0.14.1',              # as of 7/5/19: linux/circleci bugs on 0.14.0
        ],
        'tests': [
            'codecov',
            'numpy>=1.14.0',                # required by pandas, but missing from its dependencies.
            'pandas>=0.19.2',
            'pyarrow>=0.14.1',              # as of 7/5/19: linux/circleci bugs on 0.14.0
            'pytest<5.1.0',                 # TODO: Fix pytest.ensuretemp in conftest.py
            'pytest-cov',
            'pytest-env',
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
