from .._upstream import load_module

_upstream = load_module("lambdas.s3select")

lambda_handler = _upstream.lambda_handler
