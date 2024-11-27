from setuptools import find_packages, setup

setup(
    name="t4_lambda_tabular_preview",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "pyarrow ~= 18.0",
        "pandas ~= 2.2",
        "xlrd >=2,< 3",
        "openpyxl >=3,<4 ",
        "fsspec[http] >= 2022.1.0",
        (
            "t4_lambda_shared @ https://github.com/quiltdata/quilt/archive/"
            "f45d8ab51f2d60e98efda7510322f94d822e4eb4.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
