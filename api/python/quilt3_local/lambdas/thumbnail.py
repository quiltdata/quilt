from .._upstream import load_module

_upstream = load_module("lambdas.thumbnail")

lambda_handler = _upstream.lambda_handler
