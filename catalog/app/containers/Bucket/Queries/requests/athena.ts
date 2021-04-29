import Athena from 'aws-sdk/clients/athena'

import * as errors from 'containers/Bucket/errors'
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
    const workgroupsData = await athena?.listWorkGroups().promise()
    const workgroup = workgroupsData?.WorkGroups?.[0].Name

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
    if (e instanceof errors.FileNotFound || e instanceof errors.VersionNotFound) return []

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
  query: string
}

async function search({ query }: SearchArgs): Promise<AthenaSearchResults> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        query,
        body: 'It works!',
      })
    }, 1000)
  })
}

export function useAthenaSearch(query: string): AsyncData<AthenaSearchResults> {
  return useData(search, { query }, { noAutoFetch: !query })
}
