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
            "299b1da851004386ab43423172c4405997fd9c53"
            "#subdirectory=api/python"
        ),
        (
            "quilt_shared[pydantic,boto,quilt] @ git+https://github.com/quiltdata/quilt@"
            "a91eb44a1ac48d41779b3866df9bc68edbf4db3f"
            "#subdirectory=py-shared"
        ),
    ],
)
