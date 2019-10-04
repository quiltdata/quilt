import pandas as pd
import numpy as np
import quilt3
import time

def gen_large_dataframe(rows=1_000_000, cols=1_000_000):
    df = pd.DataFrame(np.random.randint(0, 100, size=(rows, cols)))
    return df

if __name__ == '__main__':
    """
    Performance testing with 1000 files
    
    Hashing: 100%|██████████| 8.85G/8.85G [02:10<00:00, 68.1MB/s]
    Copying: 100%|██████████| 8.85G/8.85G [14:28<00:00, 10.2MB/s]
    1.430265188217163 secs (1000 files this is both checking and deleting of quite large files) = 1430 for 1M files
    
    0.07088017463684082 secs (1000 files check but no delete, leveraging exception handling) = 71s for 1M files
    0.5389511585235596 secs (4000 files check but no delete, leveraging exception handling) = 134s for 1M files
    0.272479772567749 secs (4000 files check but no delete, leveraging exception handling) = 68s for 1M files
    """
    quilt3.config("https://armand-staging.quiltdata.com")
    # quilt3.login()

    pkg = quilt3.Package()

    rows = 100
    cols = 100

    num_files = 10_000

    times = []
    for i in range(num_files):
        print(i)
        logical_key = f"myLSPEdataframe{i}.parquet"
        # write_path = f"/Users/armandmcqueen/Library/Application Support/Quilt/tempfiles2/{logical_key}"
        write_path = None
        df = gen_large_dataframe(rows, cols)
        # t1 = time.time()
        pkg.set(logical_key, df, serialization_location=write_path)
        # pkg.set(logical_key, write_path)
        # t2 = time.time()
        # times.append(t2-t1)

    # avg_dur = sum(times)/len(times)
    # print(f"Took an average of {avg_dur} seconds to set")
    # pkg.build("armand/test")

    # for _, entry in pkg.walk():
    #     print(entry.get())

    # print(pkg)
    # for l in pkg.manifest:
    #     print(l)

    print("del")
    pkg._delete_temporary_files()
    # pkg.push("armand/test",
    #          "s3://armand-staging-t4",
    #          message="Test xattr")
