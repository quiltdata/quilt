import pandas as pd
import numpy as np
import time


def gen_large_dataframe(rows=1_000_000, cols=1_000_000):
    df = pd.DataFrame(np.random.randint(0, 100, size=(rows, cols)))
    return df


if __name__ == '__main__':
    print("Generating large dataframe")
    df = gen_large_dataframe(1_000_000, 100)
    print("Done generating dataframe")

    t1 = time.time()
    print("Serializing dataframe")
    df.to_csv("df.csv")
    t2 = time.time()
    print("Done writing dataframe")
    print(f'Took {t2-t1} seconds')
