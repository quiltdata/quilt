from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "awslambdaric ~= 2.0",
        "boto3 ~= 1.28",
        "pydantic ~= 1.10",
        "quilt3 ~= 5.4",
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "1859e66b10006bb814895dc5cc12c7ac98b80864"
            "#subdirectory=py-shared"
        ),
    ],
)
