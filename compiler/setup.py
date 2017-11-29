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
    version="2.7.1",
    packages=find_packages(),
    description='Quilt is a data package manager',
    long_description=readme(),
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
    ],
    author='quiltdata',
    author_email='contact@quiltdata.io',
    license='LICENSE',
    url='https://github.com/quiltdata/quilt',
    download_url='https://github.com/quiltdata/quilt/releases/tag/2.7.1',
    keywords='quilt quiltdata shareable data dataframe package platform pandas',
    install_requires=[
        'appdirs>=1.4.0',
        'enum34; python_version<"3.4"',
        'future>=0.16.0',
        'packaging>=16.8',
        'pandas>=0.19.2',
        'pyarrow>=0.4.0',
        'pyOpenSSL>=16.2.0',  # Note: not actually used at the moment.
        'pyyaml>=3.12',
        'requests>=2.12.4',
        'responses>=0.7.0',
        'six>=1.10.0',
        'tables>=3.3.0',
        'tqdm>=4.11.2',
        'xlrd>=1.0.0',
    ],
    include_package_data=True,
    entry_points={
        'console_scripts': ['quilt=quilt.tools.main:main'],
    }
)
