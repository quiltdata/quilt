"""
Makes functions in .tools.command accessible directly from quilt.
"""

# True: Force dev mode
# False: Force normal mode
# None: CLI params have not yet been parsed to determine mode.
_DEV_MODE = None


# By doing this early in the load process, we also catch ctrl-c while external libs are loading.
def _install_interrupt_handler():
    """Suppress KeyboardInterrupt traceback display in specific situations

    If not running in dev mode, and if executed from the command line, then
    we raise SystemExit instead of KeyboardInterrupt.  This provides a clean
    exit.

    :returns: None if no action is taken, original interrupt handler otherwise
    """
    # These would clutter the quilt.x namespace, so they're imported here instead.
    import os
    import sys
    import signal
    import pkg_resources

    # Check to see what entry points / scripts are configred to run quilt from the CLI
    # By doing this, we have these benefits:
    #   * Avoid closing someone's Jupyter/iPython/bPython session when they hit ctrl-c
    #   * Avoid calling exit() when being used as an external lib
    #   * Provide exceptions when running in Jupyter/iPython/bPython
    #   * Provide exceptions when running in unexpected circumstances
    quilt = pkg_resources.get_distribution('quilt')
    executable = os.path.basename(sys.argv[0])
    entry_points = quilt.get_entry_map().get('console_scripts', [])

    if executable not in entry_points:
        return

    # We're running as a console script.  Use SystemExit instead of KeyboardInterrupt
    # whenever we're not in dev mode.
    def handle_interrupt(signum, stack):
        if _DEV_MODE is None:
            # Args and environment have not been parsed, and no _DEV_MODE state has been set.
            dev_mode = True if len(sys.argv) > 1 and sys.argv[1] == '--dev' else False
            dev_mode = True if os.environ.get('QUILT_DEV_MODE', '').strip().lower() == 'true' else dev_mode
        else:  # Use forced dev-mode if _DEV_MODE is set
            dev_mode = _DEV_MODE

        if dev_mode:
            raise KeyboardInterrupt()
        print()     # avoid annoying prompt displacement when hitting ctrl-c
        exit()
    return signal.signal(signal.SIGINT, handle_interrupt)
# This should be called as early in the execution process as is possible.
# ..original handler saved in case someone wants it, but it's probably just signal.default_int_handler.
_orig_interrupt_handler = _install_interrupt_handler()


from .tools.command import (
    access_add,
    access_list,
    access_remove,
    build,
    check,
    config,
    inspect,
    install,
    log,
    login,
    login_with_token,
    logout,
    ls,
    delete,
    push,
    tag_add,
    tag_list,
    tag_remove,
    version_add,
    version_list,
)
