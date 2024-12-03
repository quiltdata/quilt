from setuptools import setup

setup(
    name='t4_lambda_transcode',
    version='0.0.1',
    py_modules=['index'],
    install_requires=[
        (
            "t4_lambda_shared @ https://github.com/quiltdata/quilt/archive/"
            "f45d8ab51f2d60e98efda7510322f94d822e4eb4.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
