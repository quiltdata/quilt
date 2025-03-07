import invariant from 'invariant'
import * as React from 'react'
import * as RR from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as workflows from 'utils/workflows'

import { displayError } from '../errors'
import * as requests from '../requests'

import Detail from './Detail'
import List from './List'

export default function Workflows() {
  const { bucket, slug } = RR.useParams<{ bucket: string; slug?: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket })

  return (
    <>
      <MetaTitle>{['Workflows', bucket]}</MetaTitle>
      {data.case({
        Ok: (config: workflows.WorkflowsConfig) =>
          slug ? (
            <Detail bucket={bucket} slug={slug} config={config} />
          ) : (
            <List bucket={bucket} config={config} />
          ),
        Err: displayError(),
        _: () => <Placeholder color="text.secondary" />,
      })}
    </>
  )
}
