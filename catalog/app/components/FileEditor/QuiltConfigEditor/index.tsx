import * as React from 'react'

import * as quiltConfigs from 'constants/quiltConfigs'
import type { S3HandleBase } from 'utils/s3paths'

import Skeleton from '../Skeleton'

import Dummy from './Dummy'
import type { QuiltConfigEditorProps as EditorProps } from './QuiltConfigEditor'

const BucketPreferences = React.lazy(() => import('./BucketPreferences'))
const Workflows = React.lazy(() => import('./Workflows'))

const QuiltConfigEditorSuspended = React.lazy(() => import('./QuiltConfigEditor'))

function getConfigDetailsFetcher(handle: S3HandleBase) {
  if (
    quiltConfigs.bucketPreferences.some((quiltConfig) => quiltConfig.includes(handle.key))
  )
    return BucketPreferences
  if (quiltConfigs.workflows.includes(handle.key)) return Workflows
  return Dummy
}

export type QuiltConfigEditorProps = EditorProps & { handle: S3HandleBase }

export default ({ handle, ...props }: QuiltConfigEditorProps) => {
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
