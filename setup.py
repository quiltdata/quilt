from setuptools import setup, find_packages

def readme():
    readme_short = """
    [Quilt] is a data package manager.
    `quilt` is a command-line tool that builds, retrieves, and stores
    data packages. A data package is a namespace of binary data frames
    (and files).

    `quilt` works in conjunction with a server-side registry,
    not covered in this document. `quilt` currently pushes to and pulls from
    the registry at [quiltdata.com](https://quiltdata.com/). In the near
    future users will be able to browse packages in the registry. You can
    use the registry to install data packages from the community, or publish
    packages for others to use.
    """
    return readme_short

setup(
    name="quilt",
    version="2.4.0",
    packages=find_packages(),
    description='Quilt is an open-source data frame registry',
    long_description=readme(),
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.6',
    ],
    author='quiltdata',
    author_email='contact@quiltdata.io',
    license='LICENSE',
    url='https://github.com/quiltdata/quilt',
    download_url='https://github.com/quiltdata/quilt/releases/tag/2.4.0-beta',
    keywords='quilt quiltdata shareable data dataframe package platform pandas',
    install_requires=[
        'appdirs>=1.4.0',
        'future>=0.16.0',
        'packaging>=16.8',
        'pandas>=0.19.2',
        'pyOpenSSL>=16.2.0',
        'pyyaml>=3.12',
        'requests>=2.12.4',
        'responses>=0.5.1',
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
