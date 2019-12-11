import time

import quilt3
import subprocess

def humanize_float(num): return "{0:,.2f}".format(num)

class Timer:
    def __init__(self, name):
        self.name = name
        self.t1 = None
        self.t2 = None

    def start(self):
        print(f'Timer "{self.name}" starting!')
        self.t1 = time.time()
        return self

    def stop(self):
        self.t2 = time.time()
        print(f'Timer "{self.name}" took {humanize_float(self.t2-self.t1)} seconds')
        return self.t2-self.t1


def run_and_print(cmd):
    print("---")
    print(f"Running: {cmd}")
    r = subprocess.check_output(cmd, shell=True)
    print(r.decode())



def time_coco2017_browse(repeats=10):
    durs = []
    for i in range(1, repeats+1):
        t = Timer(f'Browsing cv/coco2017 manifest, test {i}').start()

        pkg = quilt3.Package.browse("cv/coco2017", registry="s3://quilt-ml-data")

        dur = t.stop()
        durs.append(dur)

        del pkg

    print(durs)
    print(sum(durs)/len(durs))


if __name__ == '__main__':
    """
    export PYTHONUNBUFFERED=TRUE && export JSONL_STRATEGY=original && python jsonl_load_perf_test.py | tee ${JSONL_STRATEGY}_browse_results.log
    """
    run_and_print("pip freeze | grep quilt3")
    run_and_print("git status")
    run_and_print("git rev-parse HEAD")
    run_and_print("git log --oneline -n 10")

    time_coco2017_browse(repeats=50)




