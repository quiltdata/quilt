from setuptools import find_packages, setup

setup(
    name="t4_lambda_pkgpush",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "boto3 ~= 1.35",
        "boto3-stubs[full] ~= 1.35",
        "pydantic ~= 2.10",
        "rfc3986 ~= 2.0",
        "quilt3 >= 7, < 8",
        (
            "quilt_shared[pydantic,boto,quilt] @ https://github.com/quiltdata/quilt/archive/"
            "7698788139c8ea0b425b9932c1db6c8903526c28.zip"
            "#subdirectory=py-shared"
        ),
    ],
)
