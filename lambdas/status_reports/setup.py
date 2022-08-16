from setuptools import find_packages, setup

setup(
    name='t4_lambda_status_reports',
    version='0.0.1',
    packages=find_packages(where="src"),
    package_dir={"": "src"},
)
