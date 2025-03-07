import invariant from 'invariant'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as S from '@effect/schema/Schema'

import Placeholder from 'components/Placeholder'
import SearchRoute from 'containers/Search/Route'
import * as SearchModel from 'containers/Search/model'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as workflows from 'utils/workflows'

import * as requests from './requests'

// params -> location
const encode = S.encodeSync(SearchRoute.paramsSchema)

const LOADING = Symbol('loading')

export default function PackageSearchRedirect() {
  // XXX: respect other route params? (filter, sort, p(age))
  const { bucket } = RR.useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket })

  const workflow: string | null | typeof LOADING = React.useMemo(
    () =>
      data.case({
        Ok: (wcfg: workflows.WorkflowsConfig) => {
          const available = wcfg.workflows.filter(
            (w) => !w.isDisabled && typeof w.slug === 'string',
          )
          const found = available.find((w) => w.isDefault) ?? available[0]
          return found?.slug || null
        },
        Err: () => null,
        _: () => LOADING,
      }),
    [data],
  )

  if (workflow === LOADING) return <Placeholder color="text.secondary" />

  const loc = encode({
    buckets: [bucket],
    order: SearchModel.ResultOrder.NEWEST,
    params: {
      resultType: SearchModel.ResultType.QuiltPackage,
      filter: [
        {
          key: 'workflow',
          predicate: { terms: workflow ? [workflow] : [] },
        },
        {
          key: 'name',
          predicate: {},
        },
      ],
    },
  })

  return <RR.Redirect to={loc} />
}
