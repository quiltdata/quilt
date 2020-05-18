import time

import quilt3
from quilt3 import PhysicalKey

REGISTRY = "s3://armand-dotquilt-dev"
PACKAGE_NAME = "test/test"
MESSAGE = "none"


def create_packages():
    # NOTE: This code relies on browse working with the old registry format while push works with new registries
    pkg = quilt3.Package.browse("nlp/glue", registry="s3://quilt-ml")
    print(pkg.top_hash)

    pkg.push("test/glue", registry=REGISTRY)

    pkg["CoLA/dev.tsv"].set_meta({"k1": "v1"})
    pkg.push("test/glue", registry=REGISTRY)

    pkg["CoLA/dev.tsv"].set_meta({"k1": "v2"})
    pkg.push("test/glue", registry=REGISTRY)

    pkg["CoLA/dev.tsv"].set_meta({"k1": "v3"})
    pkg.push("test/glue", registry=REGISTRY)

    pkg = quilt3.Package.browse("cv/coco2017", registry="s3://quilt-ml")
    pkg.push("test/coco2017", registry=REGISTRY, selector_fn=lambda x, y: False)


def test_list_packages():
    print("Test List Packages")
    packages = quilt3.list_packages(registry=REGISTRY)
    for pkg in packages:
        print(pkg)

    print("Test List Packages Done")


def test_list_package_versions():
    print("Test List Package Versions")
    for version, dt_str in quilt3.list_package_versions("test/glue", registry=REGISTRY):
        print(dt_str, version)

    print("Test List Package Versions Done")


def test_resolve_hash():
    shorthash = "e99b760a"
    tophash = quilt3.Package.resolve_hash(PhysicalKey.from_url(REGISTRY), "test/glue", hash_prefix=shorthash)
    print("Shorthash", shorthash, "translates to", tophash)


def test_shorten_tophash():
    fullhash = "e99b760a05539460ac0a7349abb8f476e8c75282a38845fa828f8a5d28374303"
    shorthash = quilt3.Package._shorten_tophash("test/glue", PhysicalKey.from_url(REGISTRY), fullhash)
    print("Full tophash", fullhash, "shortened to", shorthash)


def gen_test_pkg():
    pkg = quilt3.Package()
    pkg.set("key", entry=bytes("abc".encode("utf-8")), meta={"k": "v"})
    return pkg


def test_build_browse_and_delete():
    pkg = gen_test_pkg()

    pkg = pkg.push(PACKAGE_NAME, registry=REGISTRY)
    tophash = pkg.top_hash
    time.sleep(1)

    # Confirm that the package exists in list_package_versions
    tophashes = [tophash for tophash, _ in quilt3.list_package_versions(PACKAGE_NAME, REGISTRY)]
    assert tophash in tophashes

    latest_pkg_tophash = quilt3.Package.browse(PACKAGE_NAME, registry=REGISTRY).top_hash
    assert tophash == latest_pkg_tophash, f"{tophash}, {latest_pkg_tophash}"

    quilt3.delete_package(PACKAGE_NAME, registry=REGISTRY, top_hash=tophash)

    time.sleep(0.5)
    tophashes = [tophash for tophash, _ in quilt3.list_package_versions(PACKAGE_NAME, REGISTRY)]
    assert tophash not in tophashes


def test_build_and_rollback():
    pkg = gen_test_pkg()

    pkg.push(PACKAGE_NAME, registry=REGISTRY)

    original_latest_tophash = quilt3.Package.browse(PACKAGE_NAME, registry=REGISTRY).top_hash

    pkg = gen_test_pkg()
    pkg["key"].set_meta({"k2": "v2"})
    pkg.push(PACKAGE_NAME, registry=REGISTRY)

    time.sleep(0.5)

    # Confirm latest tophash has changed
    new_latest_tophash = quilt3.Package.browse(PACKAGE_NAME, registry=REGISTRY).top_hash
    assert new_latest_tophash != original_latest_tophash

    # Rollback
    quilt3.Package.rollback(PACKAGE_NAME, registry=REGISTRY, top_hash=original_latest_tophash)
    most_recent_latest_tophash = quilt3.Package.browse(PACKAGE_NAME, registry=REGISTRY).top_hash
    assert most_recent_latest_tophash == original_latest_tophash


if __name__ == '__main__':

    # create_packages()
    # test_list_packages()
    # test_list_package_versions()

    # test_resolve_hash()
    # test_shorten_tophash()

    # test_build_browse_and_delete()
    test_build_and_rollback()
