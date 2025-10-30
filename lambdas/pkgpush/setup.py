from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3 ~= 1.35",
        "pydantic ~= 2.10",
        "rfc3986 ~= 2.0",
        (
            "quilt3 @ https://github.com/quiltdata/quilt/archive/"
            "39911cd11f6e1515853b1c67c7c77d457f5e537b.zip"
            "#subdirectory=api/python"
        ),
        (
            "quilt_shared[pydantic,boto,quilt] @ https://github.com/quiltdata/quilt/archive/"
            "6700d34e95d28039308f3c8ddb239bc91945aaf9.zip"
            "#subdirectory=py-shared"
        ),
    ],
)
