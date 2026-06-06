#!/bin/bash

set -euo pipefail

# Make sure "*" expands to an empty list rather than a literal "*" if there are no matches.
shopt -s nullglob

error() {
    echo $@ 2>&1
    exit 1
}

[ -f "/.dockerenv" ] || error "This should only run inside a lambda container."

FUNCTION_DIR="${FUNCTION_DIR:-/lambda/function}"
REPO_ROOT="${REPO_ROOT:-}"
PACKAGE_PATH="${PACKAGE_PATH:-}"

dnf --setopt=install_weak_deps=0 install -y \
    gcc \
    gcc-c++ \
    findutils \
    zip \
    binutils \
    jq \
    unzip

pip install uv

mkdir out
cd out

# install everything into a temporary directory
requirements_file="$PWD/requirements.txt"
install_targets=("$FUNCTION_DIR")
package_name=""
if [[ -n "$REPO_ROOT" && -n "$PACKAGE_PATH" && -f "$REPO_ROOT/.github/scripts/python_packaging.py" ]]; then
    mapfile -t local_install_targets < <(python "$REPO_ROOT/.github/scripts/python_packaging.py" install-targets "$PACKAGE_PATH")
    install_targets=("${local_install_targets[@]}" "$FUNCTION_DIR")
    package_name=$(python "$REPO_ROOT/.github/scripts/python_packaging.py" package-name "$PACKAGE_PATH")
fi

if [[ -n "$package_name" ]] && python "$REPO_ROOT/.github/scripts/python_packaging.py" uses-workspace "$PACKAGE_PATH"; then
    uv export --locked --project "$REPO_ROOT" --package "$package_name" --no-emit-project --no-emit-workspace --no-emit-local --no-hashes -o "$requirements_file" --no-default-groups
else
    uv export --locked --no-emit-project --no-emit-local --no-hashes --directory "$FUNCTION_DIR" -o "$requirements_file" --no-default-groups
fi
uv pip install --no-compile --no-deps --target . -r "$requirements_file" "${install_targets[@]}"
python3 -m compileall -b .

# add binaries
if [ -f "$FUNCTION_DIR/quilt_binaries.json" ]; then
    url=$(cat "$FUNCTION_DIR/quilt_binaries.json" | jq -r '.s3zip')
    echo "Adding binary deps from $url"
    bin_zip=$(realpath "$(mktemp)")
    curl -o "$bin_zip" "$url"
    bin_dir="quilt_binaries"
    mkdir "$bin_dir"
    unzip "$bin_zip" -d "$bin_dir"
    rm "$bin_zip"
fi

find . \( -name 'test_*' -o -name '*.py' -o -name '*.h' -o -name '*.c' -o -name '*.cc' -o -name '*.cpp' -o -name '*.exe' \) -type f -delete

# pyarrow is "special":
# if there's a "libfoo.so" and a "libfoo.so.1.2.3", then only the latter is actually used, so delete the former.
for lib in pyarrow/*.so.*; do rm -f "${lib%%.*}.so"; done

find . -name tests -type d -exec rm -r \{} \+
find . \( -name '*.so.*' -o -name '*.so' \) -type f \
    ! -name 'libscipy_openblas*.so' \
    -exec strip \{} \+

MAX_SIZE=262144000
size=$(du -b -s . | cut -f 1)
[[ $size -lt $MAX_SIZE ]] || error "The package size is too large: $size; must be smaller than $MAX_SIZE. Consider using docker-based deployment."

zip -r - . > /out.zip
