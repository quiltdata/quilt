from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3~=1.28",
        "pydantic~=1.10",
        "quilt3~=5.4",
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "37bd19c580c73f5272f4c85d4e3de3fdc92c561b"
            "#subdirectory=py-shared"
        ),
    ],
)
