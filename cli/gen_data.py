import os
import sys

import argparse
import yaml

from quilt.test import gen_data

class TestException(Exception):
    """
    Exception class for test generator errors
    """
    pass


def build_package(name, numdf=1):
    contents = {}
    contents['package'] = name

    pkgdir = name
    if os.path.exists(pkgdir):
        raise TestException("directory %s already exists" % pkgdir)

    os.mkdir(pkgdir)

    #generate test DFs and dump to CSV
    dataframes = []
    for i in range(numdf):
        dfname = 'df{idx}'.format(idx=i)
        outfile = "{df}.csv".format(df=dfname)
        testdf = gen_data.df()
        testdf.to_csv(os.path.join(pkgdir, outfile))
        dataframes.append((dfname, outfile))

    contents['tables'] = {dfname:
                          ['csv', outfile] for dfname, outfile in dataframes}

    with open(os.path.join(pkgdir, "build.yml"), 'w') as buildfile:
        yaml.dump(contents, buildfile)


def main(argv):
    parser = argparse.ArgumentParser(description='Test quilt build/push/install.')
    parser.add_argument('-n', '--numdf',
                        type=int,
                        default=1,
                        help='Number of DataFrames in the package.')
    parser.add_argument('name', help='Package name.')
    args = parser.parse_args(argv)

    # Build a test package
    build_package(args.name, args.numdf)


if __name__ == "__main__":
    main(sys.argv[1:])
