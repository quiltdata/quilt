from setuptools import find_packages, setup

setup(
    name="t4_lambda_s3hash",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "aiobotocore ~= 2.11",
        "botocore ~= 1.31",
        "pydantic ~= 1.10",
        "types-aiobotocore[s3] ~= 2.11",
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "a91eb44a1ac48d41779b3866df9bc68edbf4db3f"
            "#subdirectory=py-shared"
        ),
    ],
)
