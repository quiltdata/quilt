# Notes on message formats
`indexer.py` consumes messages from an SQS Queue.
Each message contains one or more S3 events (these may be synthetic events
created by the bulk indexing process).

## Sample message
```
message: {
  'messageId': 'f4feb40f-16a5-47af-89dc-091bd0fae1e2',
  'receiptHandle': 'AQEBv6rRxc4+CRSi3RWY64HqOIzu+dJEWnMCAwVgyogUBDY4a1fBoEp6mnx3qy5AO/A+qvTVRWq6lWS3D2iDc8pUGfj8BAJ2/G21/mA2OqDF8e0JdItwu+haRiFzsH87W+5HAwGjIi13Yltf1UjaZoBbrdX+jOlx2lbMTgJOgAzK6ZrHnYaJdTsY72izxAY+3zm4x7U4Cg79uGj6IezWNW+ZjlsEg20tkvexQXPr6AaTbJ0cei+IVueSTy5WUiBMjTgmKxvJEWoLr3BzUvy7uI1ECJx/6m2ya5+M0161ufyYMFqYljYFe2InV2G79fXdW2pYkHy0xnbMKLlQpmOkQyJWyyYV9J6i9MO9Qkp9l0gnyxykw9eOZ/9bn0iV5p+aoRwhkopS6e1jhx8HMtTAs30TM6Uw1TFU+vPAMPu6syIMABs=',
  'body': '{"Message": "{\\"Records\\": [{\\"eventName\\": \\"ObjectCreated:Put\\", \\"s3\\": {\\"bucket\\": {\\"name\\": \\"quilt-search-test\\"}}},]}"}',
  'attributes': {
    'ApproximateReceiveCount': '96',
    'SentTimestamp': '1563828161629',
    'SenderId': 'AROA2UCAE2SH76DGTD56K:653713b4-0f9d-411f-b318-575442e52a0f',
    'ApproximateFirstReceiveTimestamp': '1563828161629'
  },
  'messageAttributes': {},
  'md5OfBody': 'f01dbb68e764f471ef5b788a3239c5ee',
  'eventSource': 'aws:sqs',
  'eventSourceARN': 'arn:aws:sqs:us-east-1:730278974607:search-test2-IndexerQueue-1JVOHJY0X3FK3',
  'awsRegion': 'us-east-1'
}
```

## Sample event
```
{
  'eventName': 'ObjectCreated:Put',
  's3': {
    'bucket': {
      'name': 'quilt-search-test'
    },
    'object': {
      'key': 'terrain/108.png.aux.xml',
      'size': 1087,
      'eTag': '"5696ffa92da106c2b261c42fb4d5178f"',
      'versionId': 'null'
    }
  }
}
```

