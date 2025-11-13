from setuptools import find_packages, setup

setup(
    name="t4_lambda_tabular_preview",
    version="0.0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "pyarrow ~= 18.0",
        "pandas ~= 2.2",
        "xlrd >=2,< 3",
        "openpyxl >=3,<4 ",
        "fsspec[http] >= 2022.1.0",
        "anndata >= 0.8.0",
        # Stripping numpy.libs in numpy 2 results in
        # libscipy_openblas64_-ff651d7f.so: ELF load command address/offset not properly aligned
        # which is probably caused by some bug in glibc (it happens on Ubuntu 22.04, Amazon Linux 2/2023,
        # but not on Ubuntu 24.04).
        "numpy < 2",
        (
            "t4_lambda_shared @ https://github.com/quiltdata/quilt/archive/"
            "d496dffbfb4b7a2ae05f6c1f7f0cb7d5d43bc984.zip"
            "#subdirectory=lambdas/shared"
        ),
    ],
)
