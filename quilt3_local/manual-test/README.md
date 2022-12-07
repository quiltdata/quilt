# Catalog local mode manual test plan

## Set-up

```shell
# set up virtualenv and install dependecies (required only first time)
poetry install
# activate virtualenv (required for every testing session, exit with ^D)
poetry shell
```

Make sure you have AWS credentials [set up](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

## Test plan

| # | Action | Expected result |
| - | --- | --- |
| 1 | Start up the catalog: `quilt3 catalog` | Server starts up and catalog homepage opens up in the browser |
|   | Open another terminal and start a new session: `poetry shell` |   |
| 2 | Try starting up the catalog again: `quilt3 catalog` | Catalog homepage opens up right away, shell doesn't get blocked |
| 3 | Navigate to a bucket: `quilt3 catalog s3://allencell` | `allencell` bucket overview page opens up, showing some readmes and thumbnails |
| 4 | Navigate to the "Bucket" tab and explore the bucket | Everything works as expected |
| 5 | Navigate to the `previews` prefix in example bucket: `quilt3 catalog s3://quilt-example/previews/` | `quilt-example` bucket explorer opens up at the `previews` prefix |
| 6 | Click through all the files there | Correct previews displayed for all the files (except PDF, which is not supported ATM) |
| 7 | Navigate to the "Packages" tab | Package list displayed |
| 8 | Enter `foo` into the "Filter packages" box | "No matching packages found" |
| 9 | Enter `rve/ma` into the "Filter packages" box | `akarve/many-revisions` package found |
| 10 | Click on the package card | Package page opens up showing package contents |
| 11 | Click through the package contents | Correct previews displayed for the files inside the package |
| 12 | Click on the revision dropdown ("latest v") | Revisions dropdown displayed |
| 13 | Click "Show all revisions" link inside the dropdown | Revision list displayed |
| 14 | Click the topmost revision card | Contents of the selected package revision displayed |
| 15 | Navigate to a non-existent bucket: `quilt3 catalog s3://quilt-example111` | "No Such Bucket" |
| 16 | Navigate to a package: `quilt3 catalog quilt-example:robnewman/honey_bees` | Package page opens up showing package contents |
| 17 | Start up a new catalog instance: `quilt3 catalog --host 0.0.0.0 --port 5000` | Server starts up on port 5000 and catalog homepage opens up in the browser (`^C` to kill the server) |
