from setuptools import find_packages, setup

setup(
    name="t4_lambda_s3hash",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "aiobotocore ~= 2.15",
        "botocore >= 1.35.50",
        "pydantic ~= 2.10",
        "types-aiobotocore[s3] ~= 2.15",
        (
            "quilt_shared[pydantic,boto,quilt] @ https://github.com/quiltdata/quilt/archive/"
            "27752e5efe7f981947d5cc0c7353bcf3f4dadade.zip"
            "#subdirectory=py-shared"
        ),
    ],
)
