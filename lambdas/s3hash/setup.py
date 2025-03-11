from setuptools import find_packages, setup

setup(
    name="t4_lambda_s3hash",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "aiobotocore ~= 2.11",
        "botocore ~= 1.31",
        "pydantic ~= 2.10",
        "types-aiobotocore[s3] ~= 2.11",
        (
            "quilt_shared[pydantic,boto,quilt] @ https://github.com/quiltdata/quilt/archive/"
            "2818a8f869a6596f7f0833d3259fcb35797afa30.zip"
            "#subdirectory=py-shared"
        ),
    ],
)
