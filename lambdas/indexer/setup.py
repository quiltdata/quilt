from setuptools import setup

setup(
    name="es_indexer",
    version="0.0.1",
    py_modules=["index", "document_queue"],
    install_requires=[
        "boto3 ~= 1.34",
        "jsonschema ~= 3.2",
        "nbformat ~= 5.1.3",
        "pdfminer.six == 20240706",
        "python-pptx ~= 0.6.21",
        "strict-rfc3339 ~= 0.7",  # for jsonschema format
        "tenacity ~= 9.0",
        (
            "t4_lambda_shared[mem,preview] @ https://github.com/quiltdata/quilt/archive/"
            "198277e45db0aeb62e21d181930ef26f86bd3c70.zip"
            "#subdirectory=lambdas/shared"
        ),
        (
            "quilt-shared[boto,es] @ https://github.com/quiltdata/quilt/archive/"
            "df53c9ce125ea051e0d1ac41d58796336e202256.zip"
            "#subdirectory=py-shared"
        ),
    ],
)
