#!/usr/bin/env python3

import subprocess
import sys

import yaml


def _patch_pydocmd_classmethod_signatures():
    """Make pydoc-markdown tolerate ``classmethod``/``staticmethod`` descriptors.

    pydoc-markdown imports each documented object via ``cls.__dict__[name]`` (to
    avoid triggering descriptors), so methods arrive as the raw ``classmethod`` /
    ``staticmethod`` *descriptor* rather than a function. Its
    ``get_function_signature`` then checks ``hasattr(obj, "__name__")`` *before*
    its ``isinstance(obj, classmethod)`` branch.

    On Python 3.9 a ``classmethod`` descriptor had no ``__name__``, so the
    classmethod branch ran and unwrapped it. On Python >= 3.10 the descriptor
    gained ``__name__`` (and ``__wrapped__``), so the ``hasattr`` branch wins and
    ``inspect.signature()`` is called on the bare descriptor — which raises
    ``TypeError: <classmethod(...)> is not a callable object`` and aborts the
    whole docs build. This bites *every* ``@classmethod`` in the API (e.g.
    ``Package.install``), independent of any other decorator.

    We wrap ``get_function_signature`` to unwrap descriptors up front, binding a
    ``classmethod`` to its owner so the rendered signature drops the implicit
    ``cls`` — matching the output Python 3.9 produced and the committed docs.
    """
    from pydocmd import loader

    original = loader.get_function_signature

    def get_function_signature(function, owner_class=None, show_module=False):
        if isinstance(function, staticmethod):
            function = function.__func__
        elif isinstance(function, classmethod):
            function = function.__get__(None, owner_class) if owner_class is not None else function.__func__
        return original(function, owner_class, show_module)

    loader.get_function_signature = get_function_signature


def generate_cli_api_reference_docs():
    # This script relies on relative paths so it should only run if the cwd is gendocs/
    subprocess.check_call(["./gen_cli_api_reference.sh"])


def gen_walkthrough_doc():
    # This script relies on relative paths so it should only run if the cwd is gendocs/
    subprocess.check_call(["./gen_walkthrough.sh"])


if __name__ == "__main__":
    # CLI and Walkthrough docs uses custom script to generate documentation markdown, so do that first
    generate_cli_api_reference_docs()
    gen_walkthrough_doc()

    from pydocmd.__main__ import main as pydocmd_main

    # Tolerate classmethod/staticmethod descriptors under Python >= 3.10 (see the
    # function's docstring); must run before pydocmd resolves any signatures.
    _patch_pydocmd_classmethod_signatures()

    # hacky, but we should maintain the same interpreter, and we're dependent on how
    # pydocmd calls mkdocs.
    if sys.argv[-1].endswith('build.py'):
        print("Using standard args for mkdocs.")
        sys.argv.append('build')
    else:
        print("Using custom args for mkdocs.")

    print("\nStarting pydocmd_main...")

    pydocmd_main()

    print("...finished pydocmd_main")

    # report where stuff is
    with open('pydocmd.yml', encoding='utf-8') as f:
        pydocmd_config = yaml.safe_load(f)
    print("Generated HTML in {!r}".format(pydocmd_config.get('site_dir')))
    print("Generated markdown in {!r}".format(pydocmd_config.get('gens_dir')))
