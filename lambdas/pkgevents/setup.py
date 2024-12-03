from setuptools import setup

setup(
    name='pkgevents',
    version='0.0.1',
    py_modules=['index'],
    install_requires=[
        "boto3 ~= 1.34",
        (
            "t4_lambda_shared @ https://github.com/quiltdata/quilt/archive/"
            "f45d8ab51f2d60e98efda7510322f94d822e4eb4.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
