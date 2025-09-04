#!/usr/bin/env python3

import subprocess
import sys
import yaml


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
