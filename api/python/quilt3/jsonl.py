import jsonlines
import ujson
import time
import itertools
import os
from tqdm import tqdm

import multiprocessing as mp
from concurrent.futures import ThreadPoolExecutor

POOL_WORKERS=int(os.getenv("POOL_WORKERS", 10))
print(f"Num pool workers={POOL_WORKERS}")


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



def custom1_process(args):
    assert len(args) == 2
    str_line, q = args
    output = ujson.loads(str_line)
    q.put(1)
    return output


class Custom1Reader(jsonlines.jsonlines.ReaderWriterBase):


    def __init__(self, fp):

        m = mp.Manager()
        shared_queue = m.Queue()
        progress = 0
        len_timer = Timer("Calculating file length").start()
        str_lines = [f for f in fp]
        total_size = len(str_lines)
        len_timer.stop()

        with mp.Pool(POOL_WORKERS) as p:
            async_results = p.map_async(custom1_process, zip(str_lines, itertools.repeat(shared_queue)))
            with tqdm(desc="Manifest Loading Progress", total=total_size, unit_scale=True) as tqdm_progress:
                while True:
                    progress_update = shared_queue.get(block=True)
                    progress += progress_update
                    tqdm_progress.update(progress_update)

                    if progress == total_size:
                        break

            results = async_results.get()
            assert async_results.successful(), "There was an uncaught error"

        self.lines = results


    def read(self):
        return self.lines.pop(0)

    def __iter__(self):
        return self.lines.__iter__()






def custom2_process(str_line):
    output = ujson.loads(str_line)
    return output

class Custom2Reader(jsonlines.jsonlines.ReaderWriterBase):
    def __init__(self, fp):

        len_timer = Timer("Extracting lines as strings").start()
        str_lines = [f for f in fp]
        len_timer.stop()

        with mp.Pool(POOL_WORKERS) as p:
            async_results = p.map_async(custom2_process, str_lines)
            results = async_results.get()
            assert async_results.successful(), "There was an uncaught error"

        self.lines = results


    def read(self):
        return self.lines.pop(0)

    def __iter__(self):
        return self.lines.__iter__()



class Custom3Reader(jsonlines.jsonlines.ReaderWriterBase):
    def __init__(self, fp):

        len_timer = Timer("Extracting lines as strings").start()
        str_lines = [f for f in fp]
        len_timer.stop()

        array_timer = Timer("Converting lines to one big JSON array string").start()
        json_array = ",\n".join(str_lines)
        json_array = f"[{json_array}]"
        array_timer.stop()

        self.lines = ujson.loads(json_array)


    def read(self):
        return self.lines.pop(0)

    def __iter__(self):
        return self.lines.__iter__()




def custom4_process(str_line):
    output = ujson.loads(str_line)
    return output

class Custom4Reader(jsonlines.jsonlines.ReaderWriterBase):
    def __init__(self, fp):

        len_timer = Timer("Extracting lines as strings").start()
        str_lines = [f for f in fp]
        len_timer.stop()

        with ThreadPoolExecutor() as executor:
            results = executor.map(custom4_process, str_lines)

        list_timer = Timer("Converting results generator to list").start()
        self.lines = list(results)
        list_timer.stop()


    def read(self):
        return self.lines.pop(0)

    def __iter__(self):
        return self.lines.__iter__()
