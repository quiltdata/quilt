from setuptools import setup

setup(
    name='es_indexer',
    version='0.0.1',
    py_modules=['index', 'document_queue'],
    install_requires=[
        "aws-requests-auth ~= 0.4.2",
        "boto3 ~= 1.34",
        "elasticsearch ~= 6.3",
        "jsonpointer ~= 2.4",
        "jsonschema ~= 3.2",
        "nbformat ~= 5.1.3",
        "pdfminer.six == 20240706",
        "python-pptx ~= 0.6.21",
        "strict-rfc3339 ~= 0.7",  # for jsonschema format
        "tenacity ~= 9.0",
        (
            "t4_lambda_shared[mem,preview] @ https://github.com/quiltdata/quilt/archive/"
            "d496dffbfb4b7a2ae05f6c1f7f0cb7d5d43bc984.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
