"""
Makes functions in .tools.command accessible directly from quilt.
"""

# True: Force dev mode
# False: Force normal mode
# None: CLI params have not yet been parsed to determine mode.
_DEV_MODE = None


# Normally a try: except: block on or in main() would be better and simpler,
# but we load a bunch of external modules that take a lot of time, during which
# ctrl-c will cause an exception that misses that block. ..so, we catch the
# signal instead of using try:except, and we catch it here, early during load.
#
# Note: This doesn't *guarantee* that a traceback won't occur, and there's no
#   real way to do so, because if it happens early enough (during parsing, for
#   example, or inside the entry point file) we have no way to stop it.
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
    from .tools import const

    # Check to see what entry points / scripts are configred to run quilt from the CLI
    # By doing this, we have these benefits:
    #   * Avoid closing someone's Jupyter/iPython/bPython session when they hit ctrl-c
    #   * Avoid calling exit() when being used as an external lib
    #   * Provide exceptions when running in Jupyter/iPython/bPython
    #   * Provide exceptions when running in unexpected circumstances
    quilt = pkg_resources.get_distribution('quilt')
    executable = os.path.basename(sys.argv[0])
    entry_points = quilt.get_entry_map().get('console_scripts', [])

    # When python is run with '-c', this was executed via 'python -c "<some python code>"'
    if executable == '-c':
        # This is awkward and somewhat hackish, but we have to ensure that this is *us*
        # executing via 'python -c'
        if len(sys.argv) > 1 and sys.argv[1] == 'quilt testing':
            # it's us.  Let's pretend '-c' is an entry point.
            entry_points['-c'] = 'blah'
            sys.argv.pop(1)
    if executable not in entry_points:
        return

    # We're running as a console script.
    # If not in dev mode, use SystemExit instead of raising KeyboardInterrupt
    def handle_interrupt(signum, stack):
        # Check for dev mode
        if _DEV_MODE is None:
            # Args and environment have not been parsed, and no _DEV_MODE state has been set.
            dev_mode = True if len(sys.argv) > 1 and sys.argv[1] == '--dev' else False
            dev_mode = True if os.environ.get('QUILT_DEV_MODE', '').strip().lower() == 'true' else dev_mode
        else:  # Use forced dev-mode if _DEV_MODE is set
            dev_mode = _DEV_MODE

        # In order to display the full traceback, we lose control of the exit code here.
        # Dev mode ctrl-c exit just produces the generic exit error code 1
        if dev_mode:
            raise KeyboardInterrupt()
        # Normal exit
        # avoid annoying prompt displacement when hitting ctrl-c
        print()
        exit(const.EXIT_KB_INTERRUPT)

    return signal.signal(signal.SIGINT, handle_interrupt)

# This should be called as early in the execution process as is possible.
# ..original handler saved in case someone wants it, but it's probably just signal.default_int_handler.
_orig_interrupt_handler = _install_interrupt_handler()


from .tools.command import (
    access_add,
    access_list,
    access_remove,
    audit,
    build,
    check,
    config,
    create_user,
    delete_user,
    enable_user,
    disable_user,
    export,
    generate,
    inspect,
    install,
    list_packages,
    list_users,
    list_users_detailed,
    load,
    log,
    login,
    login_with_token,
    logout,
    ls,
    delete,
    push,
    rm,
    search,
    tag_add,
    tag_list,
    tag_remove,
    version_add,
    version_list,
)
