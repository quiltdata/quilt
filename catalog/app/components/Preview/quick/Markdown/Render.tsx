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
  // `result` is never `Pending`, because we pass the `AsyncResult.Ok` value
  // but it can be `Err` if some post-processing fails
  return AsyncResult.case({
    _: () => null,
    Err: (error: Error) => <Lab.Alert severity="error">{error.message}</Lab.Alert>,
    Ok: (rendered: string) => (
      <React.Suspense fallback={<Skeleton />}>
        <Markdown rendered={rendered} />
      </React.Suspense>
    ),
  })(result)
}
