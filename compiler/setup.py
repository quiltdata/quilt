from setuptools import setup, find_packages


def readme():
    readme_short = """
    ``quilt`` is a command-line utility that builds, pushes, and installs
    data packages. A `data package <https://blog.quiltdata.com/data-packages-for-fast-reproducible-python-analysis-c74b78015c7f>`_
    is a versioned bundle of serialized data wrapped in a Python module.

    ``quilt`` pushes to and pulls from the package registry at quiltdata.com.

    Visit `quiltdata.com <https://quiltdata.com>`_ for docs and more.
    """
    return readme_short


setup(
    name="quilt",
    version="2.9.8",
    packages=find_packages(),
    description='Quilt is a data package manager',
    long_description=readme(),
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
    ],
    author='quiltdata',
    author_email='contact@quiltdata.io',
    license='LICENSE',
    url='https://github.com/quiltdata/quilt',
    download_url='https://github.com/quiltdata/quilt/releases/tag/2.9.8',
    keywords='quilt quiltdata shareable data dataframe package platform pandas',
    install_requires=[
        'appdirs>=1.4.0',
        'enum34; python_version<"3.0"',     # stdlib backport
        'future>=0.16.0',                   # stdlib backport: 'from builtins import xxx', plus others.
        'packaging>=16.8',
        'pandas>=0.19.2',
        'pathlib2; python_version<"3.6"',   # stdlib backport
        'pyarrow>=0.9.0',
        'pyyaml>=3.12',
        'requests>=2.12.4',
        'six>=1.10.0',
        'tqdm>=4.11.2',
        'xlrd>=1.0.0',
    ],
    # Install with: pip install -e ./[img,tests,...]
    extras_require={
        # See quilt.asa.img module
        'img': [
            'matplotlib>=2.2.2',
            'Pillow>=5.1.0'
        ],
        # See quilt.asa.pytorch module
        'pytorch': [
            # May not install on Linux, Windows; See https://pytorch.org/
            'torch>=0.4.0',
        ],
        # For dev testing
        'tests': [
            'funcsigs; python_version<"3.4"',   # stdlib backport
            'mock; python_version<"3.3"',
            'pytest',
            'pytest-cov',
            'responses>=0.7.0',
        ],
        'torchvision': [
            'torchvision>=0.2.1'
        ]
    },
    include_package_data=True,
    entry_points={
        'console_scripts': ['quilt=quilt.tools.main:main'],
    }
)
