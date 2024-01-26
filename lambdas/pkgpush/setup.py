from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "awslambdaric>=2,<3",
        "boto3~=1.28",
        "pydantic~=1.10",
        "quilt3~=5.4",
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "e95cde71e45458c5eca4aa521678b6ba75b6528f"
            "#subdirectory=py-shared"
        ),
    ],
)
