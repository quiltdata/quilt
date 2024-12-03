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
            "d496dffbfb4b7a2ae05f6c1f7f0cb7d5d43bc984.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
