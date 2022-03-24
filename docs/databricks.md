# Running Quilt in Databricks
Many Databricks workloads consume input data from S3 and write output data to S3. Quilt packages provide a logical structure to data in S3, connecting related files, metadata, and documentation into a logical view that's available in code and in an online catalog. Databricks users can use the `quilt3` Python API to create and browse data packages in their Python notebooks.

## Install `quilt3` on Your Cluster
Before using `quilt3` in your Databricks notebooks, you'll need to install it on your cluster. Find your cluster from the __Compute__ tab. From your Cluster overview, click on the __Libraries__ tab, then click the "Install new" button. Select PyPI under Library Source and enter `quilt3` for the Package.

For more details, see the Databricks [documentation on libraries](https://docs.databricks.com/libraries/index.html).
