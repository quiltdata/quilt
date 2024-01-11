from setuptools import find_packages, setup

setup(
    name="t4_lambda_s3hash",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "aiobotocore==2.7.0",
        "botocore==1.31.64",
        "pydantic==1.10.13",
        "tenacity==6.2.0",
        "types-aiobotocore[s3]==2.7.0",
    ],
)
