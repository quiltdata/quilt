import pandas as pd
import numpy as np
import quilt3

def gen_large_dataframe(rows=1_000_000, cols=1_000_000):
    df = pd.DataFrame(np.random.randint(0, 100, size=(rows, cols)))
    return df

if __name__ == '__main__':
    quilt3.config("https://armand-staging.quiltdata.com")
    # quilt3.login()

    pkg = quilt3.Package()

    pkg.set("myLSPEdataframe1.parquet", gen_large_dataframe(100_000, 100))
    pkg.set("myLSPEdataframe2.parquet", gen_large_dataframe(100_000, 100))
    pkg.set("myLSPEdataframe3.parquet", gen_large_dataframe(100_000, 100))
    pkg.set("myLSPEdataframe4.parquet", gen_large_dataframe(100_000, 100))
    pkg.set("myLSPEdataframe5.parquet", gen_large_dataframe(100_000, 100))

    pkg.build("armand/test", serialization_dir="./dir1/dir2")
    print(pkg)
    for l in pkg.manifest:
        print(l)

    # pkg.push("armand/test",
    #          "s3://armand-staging-t4",
    #          message="Test")
