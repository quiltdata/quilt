
import io
import pandas as pd


def load_df(s3response):
    """
    Read a streaming response from s3 select into a
    Pandas DataFrame
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
    return df, statsDetails
    
def get_logical_key_folder_view(df, prefix=None):
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    if prefix:
        col = df.logical_key.str.slice(start=len(prefix))
    else:
        col = df.logical_key
        
    # matches all strings; everything before and including the first
    # / is extracted
    folder = col.dropna().str.extract('([^/]+/?).*')[0].unique().tolist()
    return folder
 
