from setuptools import setup, find_packages

def readme():
    readme_short = """
    [Quilt](https://beta.quiltdata.com/) is a data package manager.
    You can use data packages from the community, or publish packages for others to use.

    `quilt` is the command-line client that builds, retrieves, and stores
    packages. `quilt` works in conjunction with a server-side registry,
    not covered in this document. `quilt` currently pushes to and pulls from
    the registry at [beta.quiltdata.com](https://beta.quiltdata.com/). In the near
    future users will be able to browse packages in the registry.
    """
    return readme_short

setup(
    name="quilt",
    version="2.0.2",
    packages=find_packages(),
    description='Quilt is an open-source data frame registry',
    long_description=readme(),
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.5',
    ],
    author='quiltdata',
    author_email='founders@quiltdata.io',
    license='LICENSE',
    url='https://github.com/quiltdata/quilt',
    download_url='https://github.com/quiltdata/quilt/releases/tag/v2.0.0-alpha',
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
        'tables>=3.3.0',
        'xlrd>=1.0.0',
    ],
    include_package_data=True,
    entry_points={
        'console_scripts': ['quilt=quilt.tools.command:main'],
    }
)
