# Catalog Troubleshooting

## Overview stats (objects, packages) seem incorrect or aren't updating

## Packages tab doesn't work

## Packages or stats are missing or are not updating

These are all symptoms of the same underlying issue: the Elasticsearch index is
out of sync. If any of the following are true, please wait a few minutes and try
again:

- you recently added the bucket or upgraded the stack
- search volume is high, or
- read/write volume is high

If that doesn't work, try the following steps:

### Re-index the bucket

If you have less than 1 million objects in the bucket, you should re-index the
bucket:

1. Open the bucket overview in the Quilt catalog and click the gear icon (upper
right), or navigate to Admin settings > Buckets and inspect the settings of the
bucket in question.

1. Under "Indexing and notifications", click "Re-index and Repair".

> Optionally: **if and only if** bucket notifications are not working and you
> are certain that there are no other subscribers to the S3 Events of the bucket
> in question, check "Repair S3 notifications".

Bucket packages, stats, and the search index will repopulate in the next few
minutes.

However, if you have more than 1 million objects in the bucket, re-indexing will
take much longer and potentially become expensive.  In that case, please try the
below steps. If those do not work, please contact [Quilt
support](mailto:support@quiltdata.io).

### Inspect the Elasticsearch domain

1. Determine your Quilt instance's ElasticSearch domain from Amazon Console >
OpenSearch or `aws opensearch list-domain-names`. Note the domain name
(hereafter `QUILT_DOMAIN`).

1. Run the following command and save the output file:
    <!--pytest.mark.skip-->
    ```sh
    aws es describe-elasticsearch-domain --domain-name "$QUILT_DOMAIN"\
      > quilt-es-domain.json
    ```

1. Visit Amazon Console > OpenSearch > `QUILT_DOMAIN` > Cluster health.

1. Set the time range as long as possible to fully overlap with your observed
   issues.

1. Screenshot the Summary, Overall Health, and Key Performance Indicator
   sections

1. Send the JSON output file and screenshots to [Quilt
   support](mailto:support@quiltdata.io).

> As a rule you should **not** reconfigure your Elasticsearch domain directly as
> this will result in stack drift that will be lost the next time you update
> your Quilt instance.

## "Session expired" notice

There are two reasons for encountering the "Session expired" notice
after clicking the `RELOAD` button in the Quilt Catalog.

1. Your browser cache is out of date, in which case you need to:
    1. Delete session storage
    1. Delete local storage
    1. Delete cookies
1. Your Quilt user Role has been corrupted. You will need a Quilt Admin
user to reset your Quilt user Role to a default (**and valid**) Role.

## Browser Network and Console Logs

To help diagnose Catalog issues:

1. Go to the affected page in your Quilt Catalog.
1. Open the browser Developer tools:
    - Google Chrome: Press **F12**, **Ctrl+Shift+I** or from the
    Chrome menu select **More tools > Developer tools**.
1. Select the **Network** tab.
    1. Ensure the session is recorded:
        - Google Chrome: Check the red button in the upper left corner is set to
          **Record**.
    1. Ensure **Preserve Log** is enabled.
    1. Perform the action that triggers the error (e.g. clicking the `Download
       package` button).
    1. Export the logs as HAR format.
        - Google Chrome: **Ctrl + Click** anywhere on the grid of
        network requests and select **Save all as HAR with content**.
    1. Save the HAR-formatted file to your localhost.

        ![Save browser Network error logs as HAR
        content](../imgs/troubleshooting-logs-browser.png)
1. Select the **Console** tab.
    1. Perform the action that triggers the error (e.g. clicking the `Download
       package` button).
    1. Export the logs.
        - Google Chrome: **Ctrl + Click** anywhere on the grid of
        network requests and select **Save as...**.
    1. Save the log file to your localhost.
