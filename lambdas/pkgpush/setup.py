from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3 ~= 1.28",
        "pydantic ~= 1.10",
        (
            "quilt3 @ https://github.com/quiltdata/quilt/archive/"
            "5c2b79128fe4d5d1e6093ff6a7d11d09d3315843.zip"
            "#subdirectory=api/python"
        ),
        (
            "quilt_shared[pydantic,boto,quilt] @ https://github.com/quiltdata/quilt/archive/"
            "95f2b9a802c292e581db323252559410450a60e8.zip"
            "#subdirectory=py-shared"
        ),
    ],
)
