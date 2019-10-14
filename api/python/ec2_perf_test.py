import quilt3
from quilt3 import Package

import time

def humanize_float(num): return "{0:,.2f}".format(num)

class Timer:
    def __init__(self, name):
        self.name = name
        self.t1 = None
        self.t2 = None

    def start(self):
        self.t1 = time.time()
        return self

    def stop(self):
        self.t2 = time.time()
        print(f'Timer "{self.name}" took {humanize_float(self.t2-self.t1)} seconds')


def setup():
    pkg = Package()
    data_dir = "/home/ubuntu/coco/data/"
    t = Timer(f"pkg.set_dir({data_dir})").start()
    pkg.set_dir("data", data_dir)
    t.stop()
    return pkg

def perf_test():
    pkg = setup()
    t = Timer("hash files").start()
    pkg._fix_sha256()
    t.stop()

if __name__ == '__main__':
    perf_test()

