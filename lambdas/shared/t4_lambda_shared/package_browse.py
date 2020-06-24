
import io
import pandas as pd

def get_logical_key_folder_view(s3response):
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    buffer = io.StringIO()
    for event in s3response['Payload']:
        if 'Records' in event:
            records = event['Records']['Payload'].decode('utf-8')
            buffer.write(records)
        elif 'Stats' in event:
            statsDetails = event['Stats']['Details']
    buffer.seek(0)
    df = pd.read_json(buffer, lines=True)

    # matches all strings; everything before and including the first
    # / is extracted
    folder = df.logical_key.dropna().str.extract('([^/]+/?).*')[0].unique().tolist()
    return folder
