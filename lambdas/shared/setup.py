from setuptools import setup

mem_deps = [
    "psutil ~= 6.1",
]

setup(
    name="t4-lambda-shared",
    version="0.0.3",
    packages=["t4_lambda_shared"],
    install_requires=[
        "jsonschema>=2.6.0",
    ],
    extras_require={
        "tests": [
            "pytest",
            "pytest-cov",
        ],
        "mem": mem_deps,  # for t4_lambda_shared.utils.get_available_memory()
        # for t4_lambda_shared.preview
        "preview": [
            *mem_deps,
            "fcsparser ~= 0.2.1",
            "openpyxl ~= 3.1",
            "pandas ~= 2.2",
            "pyarrow ~= 18.0",
            "xlrd ~= 2.0",
        ],
        "lambda": [
            "awslambdaric>=2,<3",
        ],
    },
)
