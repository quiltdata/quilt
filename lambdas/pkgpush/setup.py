from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3 ~= 1.28",
        "pydantic ~= 1.10",
        "rfc3986 ~= 2.0",
        (
            "quilt3 @ https://github.com/quiltdata/quilt/archive/"
            "5c2b79128fe4d5d1e6093ff6a7d11d09d3315843.zip"
            "#subdirectory=api/python"
        ),
        (
            "quilt_shared[pydantic,boto,quilt] @ https://github.com/quiltdata/quilt/archive/"
            "438b031534d5c9f92734d8120e69088ae32d8fdb.zip"
            "#subdirectory=py-shared"
        ),
    ],
)
