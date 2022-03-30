import * as React from 'react'

import * as Model from 'model'
import AR from 'utils/AsyncResult'
import * as Types from 'utils/types'
import useQuery from 'utils/useQuery'

import * as errors from '../errors'
import MANIFEST_QUERY from './gql/Manifest.generated'

const MANIFEST_LIMIT = 10000

export const EMPTY_MANIFEST_ENTRIES: Model.PackageContentsFlatMap = {}

// XXX: use typeof MANIFEST_QUERY
export interface Manifest {
  entries?: Model.PackageContentsFlatMap
  meta?: Types.JsonRecord
  workflowId?: string
}

interface UseManifestParams {
  bucket: string
  name: string
  hash?: string | undefined
  skipEntries?: boolean
  pause?: boolean
}

export function useManifest({
  bucket,
  name,
  hash,
  skipEntries = false,
  pause = false,
}: UseManifestParams) {
  const res = useQuery({
    query: MANIFEST_QUERY,
    variables: {
      bucket,
      name,
      hashOrTag: hash || 'latest',
      max: MANIFEST_LIMIT,
      skipEntries,
    },
    pause: pause,
  })
  const { case: doCase } = res
  const pausedNoData = !res.data && pause
  const result = React.useMemo(() => {
    // XXX: use RemoteData?
    if (pausedNoData) return AR.Pending()
    return doCase({
      data: (data) => {
        const r = data.package?.revision
        // TODO: more appropriate error?
        if (!r) return AR.Err(new Error('no data'))
        if (!r.contentsFlatMap && !skipEntries)
          return AR.Err(
            new errors.ManifestTooLarge({
              bucket,
              hash: r.hash,
              max: MANIFEST_LIMIT,
            }),
          )
        return AR.Ok({
          entries: r.contentsFlatMap ?? undefined,
          meta: r.userMeta ?? undefined,
          workflowId: r.workflow?.id ?? undefined,
        })
      },
      error: AR.Err,
      fetching: AR.Pending,
    })
  }, [pausedNoData, doCase, bucket, skipEntries])

  return React.useMemo(
    () => ({
      result,
      case: (cases: $TSFixMe, ...args: $TSFixMe) => AR.case(cases, result, ...args),
    }),
    [result],
  )
}
