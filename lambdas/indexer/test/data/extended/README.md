If you run `pytest --extended` the test harness will look for parquet, etc. files
in this folder and run a few conditional tests. This is useful for testing
one-off / customer issues

You should probably .gitignore extended/*
