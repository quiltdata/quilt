import pandas as pd
import quilt3



if __name__ == '__main__':
    df = pd.DataFrame([1,2,3])

    pkg = quilt3.Package()

    pkg.set("mydataframe.parquet", df, verbose=True)
