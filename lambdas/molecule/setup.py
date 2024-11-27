from setuptools import find_packages, setup

setup(
    name="t4_lambda_molecule",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "requests ~= 2.32.2",
        (
            "t4_lambda_shared[lambda] @ https://github.com/quiltdata/quilt/archive/"
            "f45d8ab51f2d60e98efda7510322f94d822e4eb4.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
