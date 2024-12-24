from setuptools import setup

setup(
    name='lambda_function',
    version='0.0.1',
    py_modules=['index'],
    install_requires=[
        (
            "t4_lambda_shared @ https://github.com/quiltdata/quilt/archive/"
            "d496dffbfb4b7a2ae05f6c1f7f0cb7d5d43bc984.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
