from __future__ import annotations

import ast
from collections.abc import Iterable
from pathlib import Path

FRAGMENTS_PATH = Path(__file__).resolve().parent.parent / "quilt3" / "_graphql_client" / "fragments.py"


def _get_header(source: str) -> str:
    header_lines: list[str] = []
    for line in source.splitlines():
        if line.startswith("#") or not line.strip():
            header_lines.append(line)
            continue
        break
    return "\n".join(header_lines).rstrip()


def _iter_annotation_refs(node: ast.AST, sibling_names: set[str]) -> Iterable[str]:
    for child in ast.walk(node):
        if isinstance(child, ast.Name) and child.id in sibling_names:
            yield child.id
        elif isinstance(child, ast.Constant) and isinstance(child.value, str) and child.value in sibling_names:
            yield child.value


def _get_class_dependencies(class_def: ast.ClassDef, sibling_names: set[str]) -> set[str]:
    dependencies = {
        base.id
        for base in class_def.bases
        if isinstance(base, ast.Name) and base.id in sibling_names
    }

    for statement in class_def.body:
        if isinstance(statement, ast.AnnAssign):
            dependencies.update(_iter_annotation_refs(statement.annotation, sibling_names))

    dependencies.discard(class_def.name)
    return dependencies


class _AnnotationRefResolver(ast.NodeTransformer):
    def __init__(self, *, current_name: str, sibling_names: set[str], defined_names: set[str]) -> None:
        self.current_name = current_name
        self.sibling_names = sibling_names
        self.defined_names = defined_names

    def visit_Constant(self, node: ast.Constant) -> ast.AST:
        if (
            isinstance(node.value, str)
            and node.value in self.sibling_names
            and node.value != self.current_name
            and node.value in self.defined_names
        ):
            return ast.copy_location(ast.Name(id=node.value, ctx=ast.Load()), node)
        return node


def _stable_toposort(class_defs: list[ast.ClassDef]) -> list[ast.ClassDef]:
    sibling_names = {class_def.name for class_def in class_defs}
    dependencies = {
        class_def.name: _get_class_dependencies(class_def, sibling_names)
        for class_def in class_defs
    }
    original_order = {class_def.name: index for index, class_def in enumerate(class_defs)}
    remaining = {class_def.name: class_def for class_def in class_defs}
    ordered: list[ast.ClassDef] = []

    while remaining:
        ready = [
            name
            for name, deps in dependencies.items()
            if name in remaining and deps.issubset({class_def.name for class_def in ordered})
        ]
        if not ready:
            ready = [min(remaining, key=original_order.__getitem__)]

        for name in sorted(ready, key=original_order.__getitem__):
            ordered.append(remaining.pop(name))

    return ordered


def _resolve_annotations(class_defs: list[ast.ClassDef]) -> list[ast.ClassDef]:
    sibling_names = {class_def.name for class_def in class_defs}
    defined_names: set[str] = set()

    for class_def in class_defs:
        resolver = _AnnotationRefResolver(
            current_name=class_def.name,
            sibling_names=sibling_names,
            defined_names=defined_names,
        )
        for statement in class_def.body:
            if isinstance(statement, ast.AnnAssign):
                statement.annotation = resolver.visit(statement.annotation)
        defined_names.add(class_def.name)

    return class_defs


def main() -> None:
    source = FRAGMENTS_PATH.read_text()
    header = _get_header(source)
    module = ast.parse(source)

    class_defs = [statement for statement in module.body if isinstance(statement, ast.ClassDef)]
    if not class_defs:
        return

    first_class_index = next(index for index, statement in enumerate(module.body) if isinstance(statement, ast.ClassDef))
    last_class_index = max(index for index, statement in enumerate(module.body) if isinstance(statement, ast.ClassDef))

    ordered_class_defs = _resolve_annotations(_stable_toposort(class_defs))
    module.body = [
        *module.body[:first_class_index],
        *ordered_class_defs,
        *module.body[last_class_index + 1 :],
    ]
    ast.fix_missing_locations(module)

    formatted = ast.unparse(module)
    FRAGMENTS_PATH.write_text(f"{header}\n\n{formatted}\n")


if __name__ == "__main__":
    main()
