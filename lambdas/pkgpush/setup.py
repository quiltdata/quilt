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
            "quilt3 @ git+https://github.com/quiltdata/quilt@"
            # TODO: update to master hash
            "9af37a30d526230120c72656653ed28d6dec98c5"
            "#subdirectory=api/python"
        ),
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            # TODO: update to master hash
            "9af37a30d526230120c72656653ed28d6dec98c5"
            "#subdirectory=py-shared"
        ),
    ],
)
