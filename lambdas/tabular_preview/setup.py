from setuptools import find_packages, setup

setup(
    name="t4_lambda_tabular_preview",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "pyarrow>=6.0.1,<7",
        "fsspec[http]>=2022.1.0",
    ],
)
