from setuptools import find_packages, setup

setup(
    name="t4_lambda_s3hash",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "aiobotocore ~= 2.11",
        "awslambdaric ~= 2.0",
        "botocore ~= 1.31",
        "pydantic ~= 1.10",
        "tenacity ~= 6.2",
        "types-aiobotocore[s3] ~= 2.11",
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "1859e66b10006bb814895dc5cc12c7ac98b80864"
            "#subdirectory=py-shared"
        ),
    ],
)
