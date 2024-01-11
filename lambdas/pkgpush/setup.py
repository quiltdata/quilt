from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3==1.28.67",
        "pydantic==1.10.13",
        "quilt3==5.4.0",
    ],
)
