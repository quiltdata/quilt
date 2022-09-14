from setuptools import find_packages, setup

setup(
    name='t4_lambda_thumbnail',
    version='0.0.1',
    packages=find_packages(where="src"),
    package_dir={"": "src"},
)
