"""
Logging utilities for Quilt3 search operations.

This module provides convenient functions to configure logging for search operations,
making it easier to debug and monitor search performance in applications.
"""

import logging
import sys
from typing import Optional, Union


def configure_search_logging(
    level: Union[str, int] = logging.INFO,
    format_string: Optional[str] = None,
    include_console: bool = True,
    log_file: Optional[str] = None
) -> None:
    """
    Configure logging for Quilt3 search operations.
    
    Args:
        level: Logging level (e.g., 'DEBUG', 'INFO', 'WARNING', or logging constants)
        format_string: Custom log format string. If None, uses a default format.
        include_console: Whether to include console logging
        log_file: Optional file path for logging to file
    
    Example:
        >>> import quilt3.search_logging
        >>> # Enable debug logging to console and file
        >>> quilt3.search_logging.configure_search_logging(
        ...     level='DEBUG',
        ...     log_file='search_debug.log'
        ... )
        >>> 
        >>> # Now search operations will be logged
        >>> import quilt3
        >>> results = quilt3.search_packages("machine learning")
    """
    # Get search-related loggers
    search_loggers = [
        'quilt3._search',
        'quilt3.__init__',
        'quilt3.tests.integration.test_live_search_auth',
        'quilt3.tests.integration.test_live_search_data', 
        'quilt3.tests.integration.test_live_search_performance',
        'quilt3.tests.integration.test_live_search_multi_bucket'
    ]
    
    # Default format string
    if format_string is None:
        format_string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Convert string level to logging constant
    if isinstance(level, str):
        level = getattr(logging, level.upper())
    
    # Configure handlers
    handlers = []
    
    if include_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        console_handler.setFormatter(logging.Formatter(format_string))
        handlers.append(console_handler)
    
    if log_file:
        file_handler = logging.FileHandler(log_file, mode='a')
        file_handler.setLevel(level)
        file_handler.setFormatter(logging.Formatter(format_string))
        handlers.append(file_handler)
    
    # Configure each logger
    for logger_name in search_loggers:
        logger = logging.getLogger(logger_name)
        logger.setLevel(level)
        
        # Remove existing handlers to avoid duplicates
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        
        # Add new handlers
        for handler in handlers:
            logger.addHandler(handler)
        
        # Prevent propagation to root logger to avoid duplicate messages
        logger.propagate = False


def enable_debug_logging(log_file: Optional[str] = None) -> None:
    """
    Enable debug-level logging for search operations.
    
    This is a convenience function that sets up comprehensive debug logging
    with detailed information about search operations.
    
    Args:
        log_file: Optional file path for logging to file
    
    Example:
        >>> import quilt3.search_logging
        >>> quilt3.search_logging.enable_debug_logging('search_debug.log')
    """
    configure_search_logging(
        level=logging.DEBUG,
        format_string='%(asctime)s - %(name)s:%(lineno)d - %(levelname)s - %(message)s',
        include_console=True,
        log_file=log_file
    )


def disable_search_logging() -> None:
    """
    Disable all search-related logging.
    
    This function removes all handlers from search loggers and sets them
    to a high level to effectively disable logging.
    
    Example:
        >>> import quilt3.search_logging
        >>> quilt3.search_logging.disable_search_logging()
    """
    search_loggers = [
        'quilt3._search',
        'quilt3.__init__',
        'quilt3.tests.integration.test_live_search_auth',
        'quilt3.tests.integration.test_live_search_data', 
        'quilt3.tests.integration.test_live_search_performance',
        'quilt3.tests.integration.test_live_search_multi_bucket'
    ]
    
    for logger_name in search_loggers:
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.CRITICAL + 1)  # Effectively disable
        
        # Remove all handlers
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)


def get_search_logger(name: str) -> logging.Logger:
    """
    Get a properly configured logger for search-related operations.
    
    Args:
        name: Logger name (typically __name__ from the calling module)
    
    Returns:
        Configured logger instance
    
    Example:
        >>> import quilt3.search_logging
        >>> logger = quilt3.search_logging.get_search_logger(__name__)
        >>> logger.info("This is a search-related log message")
    """
    logger = logging.getLogger(name)
    
    # Set a reasonable default level if not configured
    if logger.level == logging.NOTSET:
        logger.setLevel(logging.INFO)
    
    # Add a default handler if none exist
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        logger.addHandler(handler)
        logger.propagate = False
    
    return logger


def log_search_performance(func):
    """
    Decorator to log performance metrics for search functions.
    
    This decorator can be applied to search-related functions to automatically
    log execution time and basic performance metrics.
    
    Example:
        >>> import quilt3.search_logging
        >>> 
        >>> @quilt3.search_logging.log_search_performance
        ... def my_search_function():
        ...     return quilt3.search_packages("test")
    """
    import functools
    import time
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        logger = get_search_logger(func.__module__)
        
        logger.info(f"Starting {func.__name__} with args={args[:3]}{'...' if len(args) > 3 else ''}, "
                   f"kwargs={list(kwargs.keys())}")
        
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            
            # Try to get result count if it's a SearchResult
            result_count = getattr(result, '__len__', lambda: 'unknown')()
            if hasattr(result, 'hits'):
                result_count = len(result.hits)
            
            logger.info(f"Completed {func.__name__} in {duration:.3f}s with {result_count} results")
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Failed {func.__name__} after {duration:.3f}s: {e}")
            raise
    
    return wrapper