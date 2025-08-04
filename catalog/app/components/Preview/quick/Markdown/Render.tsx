import * as React from 'react'
import * as Lab from '@material-ui/lab'

import { useMarkdownRenderer } from 'components/Preview/loaders/Markdown'
import Markdown from 'components/Preview/renderers/Markdown'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import Skeleton from './Skeleton'

interface RenderProps {
  value: string
  handle: Model.S3.S3ObjectLocation
}

export default function Render({ value, handle }: RenderProps) {
  const result = useMarkdownRenderer(AsyncResult.Ok(value), handle)
  // `result` is never `Pending` or `Init`, because we pass the `AsyncResult.Ok` value
  // but it can be `Err` if some post-processing fails
  return AsyncResult.case({
    _: (x: { value?: Error }) => (
      <Lab.Alert severity="error">{x.value?.message || 'Unexpected state'}</Lab.Alert>
    ),
    Ok: (rendered: string) => (
      <React.Suspense fallback={<Skeleton />}>
        <Markdown rendered={rendered} />
      </React.Suspense>
    ),
  })(result)
}
