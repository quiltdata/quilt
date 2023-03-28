import * as React from 'react'

import * as quiltConfigs from 'constants/quiltConfigs'
import * as Model from 'model'

import Skeleton from '../Skeleton'

import Dummy from './Dummy'
import type { QuiltConfigEditorProps } from './QuiltConfigEditor'

const BucketPreferences = React.lazy(() => import('./BucketPreferences'))
const Workflows = React.lazy(() => import('./Workflows'))

const QuiltConfigEditorSuspended = React.lazy(() => import('./QuiltConfigEditor'))

function getConfigDetailsFetcher(handle: Model.S3.S3ObjectLocation) {
  if (
    quiltConfigs.bucketPreferences.some((quiltConfig) => quiltConfig.includes(handle.key))
  )
    return BucketPreferences
  if (quiltConfigs.workflows.includes(handle.key)) return Workflows
  return Dummy
}

export default ({
  handle,
  ...props
}: QuiltConfigEditorProps & { handle: Model.S3.S3ObjectLocation }) => {
  const ConfigDetailsFetcher = getConfigDetailsFetcher(handle)
  return (
    <React.Suspense fallback={<Skeleton />}>
      <ConfigDetailsFetcher>
        {({ header, schema }) => (
          <QuiltConfigEditorSuspended {...props} header={header} schema={schema} />
        )}
      </ConfigDetailsFetcher>
    </React.Suspense>
  )
}
