import os
import sys

from setuptools import setup, find_packages
from setuptools.command.install import install

VERSION = "3.0.0"

def readme():
    readme_short = """
    Quilt is a data management tool designed for data discoverability, data dependency
    management, and data version control using `data packages <https://blog.quiltdata.com/data-packages-for-fast-reproducible-python-analysis-c74b78015c7f>`_.

    The `quilt` PyPi package allows you to build, push, and pull data packages in Quilt using Python.
    Visit the `documentation quickstart <https://quiltdocs.gitbook.io/quilt/quickstart>`_ for more information.

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
    name="quilt",
    version=VERSION,
    packages=find_packages(),
    description='Quilt: where data comes together',
    long_description=readme(),
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3.5',
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
        'elasticsearch~=6.3.1',
        'enum34; python_version<"3.0"',     # stdlib backport
        'future>=0.16.0',                   # stdlib backport: 'from builtins import xxx', plus others.
        'jsonlines==1.2.0',
        'numpy>=1.14.0',                    # required by pandas, but missing from its dependencies.
        'packaging>=16.8',
        'pandas>=0.19.2',
        'pathlib2; python_version<="3.5"',  # stdlib backport
        'pyarrow>=0.9.0',
        'requests>=2.12.4',
        'ruamel.yaml<=0.15.70',
        'six>=1.10.0',
        'tqdm>=4.26.0',
        'urllib3<1.25,>=1.21.1',             # required by requests
        'xattr>=0.9.6; platform_system!="Windows"',
        'humanize',
        'ipywidgets>=0.6.0'                 # required by tqdm.autonotebook
    ],
    extras_require={
        'tests': [
            'codecov',
            'pytest',
            'pytest-cov',
            'responses',
            'tox',
            'detox',
            'tox-pytest-summary',
        ],
    },
    include_package_data=True,
    entry_points={
        'console_scripts': ['quilt=quilt.main:main'],
    },
    cmdclass={
        'verify': VerifyVersionCommand,
    }    
)
