import quilt3
import time

DOMAIN = 'stable'
WORKGROUP = f'QuiltUserAthena-tf-{DOMAIN}-NonManagedRoleWorkgroup'
TABLE = 'ccle_tsv'

quilt3.config(f'https://{DOMAIN}.quilttest.com/')
quilt3.login()
session = quilt3.get_boto3_session()
athena_client = session.client('athena')

request = athena_client.start_query_execution(
    QueryString=f'SELECT * FROM "{TABLE}" LIMIT 10',
    QueryExecutionContext={
        'Catalog': f'quilt-tf-{DOMAIN}-tabulator',
        'Database': 'udp-spec'
    },
    WorkGroup=WORKGROUP
)
query_execution_id = request['QueryExecutionId']
print(f'Query execution ID: {query_execution_id}')

while True:
    response = athena_client.get_query_execution(QueryExecutionId=query_execution_id)
    state = response['QueryExecution']['Status']['State']
    if state in ('SUCCEEDED', 'FAILED', 'CANCELLED'):
        break
    print(f'\tQuery state: {state}')
    time.sleep(1)
print(f'Query finished with state: {state}')

results = athena_client.get_query_results(QueryExecutionId=query_execution_id)
for row in results['ResultSet']['Rows']:
    print([field.get('VarCharValue') for field in row['Data']])
