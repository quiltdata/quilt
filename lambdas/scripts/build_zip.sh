#!/bin/bash

set -e

# Make sure "*" expands to an empty list rather than a literal "*" if there are no matches.
shopt -s nullglob

error() {
    echo $@ 2>&1
    exit 1
}

[ -f "/.dockerenv" ] || error "This should only run inside of quiltdata/lambda container."

mkdir out
cd out

pip3 install -U pip setuptools

# remove pre-installed lambda packages from requirements.txt
preinstalled=$(pip freeze | cut -d '=' -f 1)
preinstalled_regex=${preinstalled//$'\n'/|}
grep -v -E -i "^(${preinstalled_regex})==" /lambda/function/requirements.txt > filtered_requirements.txt || true

# install everything into a temporary directory
pip3 install --no-compile --no-deps -t . /lambda/shared/ -r filtered_requirements.txt /lambda/function/
python3 -m compileall -b .

# add binaries
if [ -f /lambda/function/quilt_binaries.json ]; then
    url=$(cat /lambda/function/quilt_binaries.json | jq -r '.s3zip')
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
find . \( -name '*.so.*' -o -name '*.so' \) -type f -exec strip \{} \+

MAX_SIZE=262144000
size=$(du -b -s . | cut -f 1)
[[ $size -lt $MAX_SIZE ]] || error "The package size is too large: $size; must be smaller than $MAX_SIZE."

zip -r - . > /out.zip
