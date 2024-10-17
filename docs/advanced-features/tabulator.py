# Included for testing; should remove before release

import quilt3
import time

DOMAIN = 'stable'
WORKGROUP = f'QuiltUserAthena-tf-{DOMAIN}-NonManagedRoleWorkgroup'
QUERY = f'SELECT * FROM "quilt-tf-{DOMAIN}-tabulator"."udp-spec"."ccle_tsv" LIMIT 10'

quilt3.config(f'https://{DOMAIN}.quilttest.com/')
quilt3.login()
session = quilt3.get_boto3_session()
athena_client = session.client('athena')

response = athena_client.start_query_execution(
    QueryString=QUERY,
    WorkGroup=WORKGROUP
)
query_execution_id = response['QueryExecutionId']
print(f'Query execution ID: {query_execution_id}')

while True:
    execution_response = athena_client.get_query_execution(QueryExecutionId=query_execution_id)
    state = execution_response['QueryExecution']['Status']['State']
    if state in ('SUCCEEDED', 'FAILED', 'CANCELLED'):
        break
    print(f'\tQuery state: {state}')
    time.sleep(1)
print(f'Query finished with state: {state}')

if state == 'SUCCEEDED':
    results = athena_client.get_query_results(QueryExecutionId=query_execution_id)
    for row in results['ResultSet']['Rows']:
        print([field.get('VarCharValue') for field in row['Data']])
else:
    print(f'Query did not succeed. Final state: {state}')

