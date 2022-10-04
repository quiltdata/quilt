import * as React from 'react'

import * as quiltConfigs from 'constants/quiltConfigs'
import type { S3HandleBase } from 'utils/s3paths'

import Skeleton from '../Skeleton'

import type { QuiltConfigEditorProps } from './QuiltConfigEditor'

const BucketPreferences = React.lazy(() => import('./BucketPreferences'))
const Workflows = React.lazy(() => import('./Workflows'))

function DummySchemaFetcher({
  children,
}: {
  children: (props: { schema: undefined }) => React.ReactElement
}) {
  return children({ schema: undefined })
}

const QuiltConfigEditorSuspended = React.lazy(() => import('./QuiltConfigEditor'))

function getSchemaFetcher(handle: S3HandleBase) {
  if (
    quiltConfigs.bucketPreferences.some((quiltConfig) => quiltConfig.includes(handle.key))
  )
    return BucketPreferences
  if (quiltConfigs.workflows.includes(handle.key)) return Workflows
  return DummySchemaFetcher
}

export default ({
  handle,
  ...props
}: QuiltConfigEditorProps & { handle: S3HandleBase }) => {
  const SchemaFetcher = getSchemaFetcher(handle)
  return (
    <React.Suspense fallback={<Skeleton />}>
      <SchemaFetcher>
        {({ schema }) => <QuiltConfigEditorSuspended {...props} schema={schema} />}
      </SchemaFetcher>
    </React.Suspense>
  )
}
