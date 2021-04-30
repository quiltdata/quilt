import Athena from 'aws-sdk/clients/athena'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'

import { AsyncData } from './requests'

interface NamedQueriesArgs {
  athena: Athena
}

export interface AthenaQuery {
  body: string
  description?: string
  key: string
  name: string
}

export const namedQueries = async ({
  athena,
}: NamedQueriesArgs): Promise<AthenaQuery[] | null> => {
  try {
    const workgroups = await fetchWorkgroups({ athena })
    const workgroup = workgroups[0].name

    const queryIdsData = await athena
      ?.listNamedQueries({ WorkGroup: workgroup })
      .promise()

    const queriesData = await athena
      ?.batchGetNamedQuery({ NamedQueryIds: queryIdsData.NamedQueryIds || [] })
      .promise()
    return (queriesData.NamedQueries || []).map((query) => ({
      body: query.QueryString,
      description: query.Description,
      key: query.NamedQueryId!,
      name: query.Name,
    }))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useNamedQueries(bucket: string): AsyncData<AthenaQuery[]> {
  const athena = AWS.Athena.use()
  return useData(namedQueries, { athena, bucket })
}

export type AthenaSearchResults = object | null

interface SearchArgs {
  athena: Athena
  queryBody: string
  workgroup: string
}

async function search({
  athena,
  queryBody,
  workgroup,
}: SearchArgs): Promise<AthenaSearchResults> {
  try {
    const { QueryExecutionId } = await athena
      .startQueryExecution({
        QueryString: queryBody,
        ResultConfiguration: {
          EncryptionConfiguration: {
            EncryptionOption: 'SSE_S3',
          },
          // OutputLocation: 's3://fiskus-sandbox-dev/fiskus/sandbox/'
        },
        WorkGroup: workgroup,
      })
      .promise()
    if (!QueryExecutionId) throw new Error('No execution id')
    const results = await athena.getQueryResults({ QueryExecutionId })
    return results
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        queryBody,
        body: 'It works!',
      })
    }, 1000)
  })
}

export function useAthenaSearch(
  workgroup: string,
  queryBody: string,
): AsyncData<AthenaSearchResults> {
  const athena = AWS.Athena.use()
  return useData(search, { athena, queryBody, workgroup }, { noAutoFetch: !queryBody })
}

interface WorkgroupsArgs {
  athena: Athena
}

async function fetchWorkgroups({
  athena,
}: WorkgroupsArgs): Promise<AthenaWorkgroupsResults> {
  try {
    const workgroupsData = await athena.listWorkGroups().promise()
    return (workgroupsData.WorkGroups || []).map(({ Name }) => ({
      name: Name || 'Unknown',
    }))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export type AthenaWorkgroupsResults = { name: string }[]

export function useAthenaWorkgroups(): AsyncData<AthenaWorkgroupsResults> {
  const athena = AWS.Athena.use()
  return useData(fetchWorkgroups, { athena })
}
