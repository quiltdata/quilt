from setuptools import find_packages, setup

setup(
    name="t4_lambda_molecule",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "requests==2.27.1",
    ],
)
