from setuptools import find_packages, setup

setup(
    name="t4_lambda_status_reports",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    include_package_data=True,
    install_requires=[
        "Jinja2==3.1.5",
        "aiobotocore==2.3.4",
        "botocore==1.24.21",
    ],
)
