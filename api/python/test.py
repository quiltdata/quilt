
import sys

from quilt3 import Package

def main(argv):
    p = Package()
    prefix = argv[0] if len(argv) > 0 else None
    print(p.ls(prefix))

if __name__ == "__main__":
    main(sys.argv[1:])

