from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3 ~= 1.28",
        "pydantic ~= 1.10",
        "quilt3 ~= 5.4",
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "33b7e601baee6dff4ef32342b493f55d3dd16210"
            "#subdirectory=py-shared"
        ),
    ],
)
