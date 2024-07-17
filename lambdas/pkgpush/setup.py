from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3 ~= 1.28",
        "pydantic ~= 2.8",
        (
            "quilt3 @ git+https://github.com/quiltdata/quilt@"
            "5c2b79128fe4d5d1e6093ff6a7d11d09d3315843"
            "#subdirectory=api/python"
        ),
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "b56fe52de4590242f998a23401017b3014411306"
            "#subdirectory=py-shared"
        ),
    ],
)
