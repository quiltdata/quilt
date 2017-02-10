from setuptools import setup, find_packages

setup(
    name="quilt",
    version="2.0",
    packages=find_packages(),
    install_requires=[
        'appdirs>=1.4.0',
        'future>=0.16.0',
        'pandas>=0.19.2',
        'pyOpenSSL>=16.2.0',
        'pyyaml>=3.12',
        'requests>=2.12.4',
        'responses>=0.5.1',
        'tables>=3.3.0',
        'xlrd>=1.0.0',
    ],
    entry_points={
        'console_scripts': ['quilt=quilt.tools.command:main'],
    }
)
