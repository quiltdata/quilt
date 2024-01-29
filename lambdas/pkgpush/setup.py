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
            "2bf2da9499541eecd1fc57defafb309883af561e"
            "#subdirectory=py-shared"
        ),
    ],
)
