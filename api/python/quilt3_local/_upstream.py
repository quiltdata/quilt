from __future__ import annotations

import importlib.machinery
import importlib.util
import sys
from functools import lru_cache
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
UPSTREAM_ALIAS = "_quilt3_local_upstream"


@lru_cache
def package_dir() -> Path:
    search_paths = []
    for entry in sys.path:
        resolved = Path(entry or ".").resolve()
        if resolved == PROJECT_ROOT:
            continue
        search_paths.append(str(resolved))

    spec = importlib.machinery.PathFinder.find_spec("quilt3_local", search_paths)
    if spec is None or spec.origin is None:
        raise ImportError("Unable to locate upstream quilt3_local package")
    return Path(spec.origin).resolve().parent


def resource_path(name: str) -> Path:
    return package_dir() / name


def load_module(name: str = ""):
    alias = f"{UPSTREAM_ALIAS}.{name}" if name else UPSTREAM_ALIAS
    if alias in sys.modules:
        return sys.modules[alias]

    if name and UPSTREAM_ALIAS not in sys.modules:
        load_module("")

    if name:
        parent = name.rpartition(".")[0]
        if parent:
            load_module(parent)

    pkg_dir = package_dir()
    if not name:
        path = pkg_dir / "__init__.py"
        submodule_search_locations = [str(pkg_dir)]
    else:
        rel = Path(*name.split("."))
        init_path = pkg_dir / rel / "__init__.py"
        module_path = pkg_dir / f"{rel}.py"
        if init_path.exists():
            path = init_path
            submodule_search_locations = [str(init_path.parent)]
        else:
            path = module_path
            submodule_search_locations = None

    spec = importlib.util.spec_from_file_location(
        alias,
        path,
        submodule_search_locations=submodule_search_locations,
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load upstream module: {name or 'quilt3_local'}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[alias] = module
    spec.loader.exec_module(module)
    return module
