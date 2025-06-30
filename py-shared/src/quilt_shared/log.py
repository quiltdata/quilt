import logging
import os


LOGGER_NAME = "quilt-lambda"  # XXX


def get_quilt_logger():
    """inject a logger via kwargs, with level set by the environment"""
    logger_ = logging.getLogger(LOGGER_NAME)
    # See https://docs.python.org/3/library/logging.html#logging-levels
    level = os.environ.get("QUILT_LOG_LEVEL", "WARNING")
    logger_.setLevel(level)

    return logger_
