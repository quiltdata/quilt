from setuptools import find_packages, setup

setup(
    name='t4_lambda_preview',
    version='0.0.1',
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "nbconvert ~= 7.16",
        "nbformat ~= 5.10",
        "pandas ~= 2.2",
        "requests ~= 2.32",
        (
            "t4_lambda_shared[mem,preview] @ https://github.com/quiltdata/quilt/archive/"
            "cc09a5b7cab9a7ea447e700bbc94ddb3ccb3f989.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
