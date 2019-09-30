import pandas as pd
import quilt3



if __name__ == '__main__':
    quilt3.config("https://armand-staging.quiltdata.com")
    # quilt3.login()
    df = pd.DataFrame([1,2,3])

    pkg = quilt3.Package()

    pkg.set("myLSPEdataframe.parquet", df)

    pkg.push("armand/test",
             "s3://armand-staging-t4",
             message="Test")
