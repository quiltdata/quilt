import * as React from 'react'
import * as Lab from '@material-ui/lab'

import { useMarkdownRenderer } from 'components/Preview/loaders/Markdown'
import Markdown from 'components/Preview/renderers/Markdown'
import type * as Model from 'model'
import * as AsyncResult from 'utils/AsyncResult'

import Skeleton from './Skeleton'

interface RenderProps {
  value: string
  handle: Model.S3.S3ObjectLocation
}

export default function Render({ value, handle }: RenderProps) {
  const result: AsyncResult.AsyncResult<string, Error> = useMarkdownRenderer(
    AsyncResult.ok(value),
    handle,
  )
  // `result` is never `Pending` or `Init` here, because we pass an `Ok` value —
  // but it can be `Err` if some post-processing fails. The `Err` handler gets
  // the unboxed error; the `_` fallback (the impossible Init/Pending) is a guard.
  return AsyncResult.match({
    Ok: (rendered: string) => (
      <React.Suspense fallback={<Skeleton />}>
        <Markdown rendered={rendered} />
      </React.Suspense>
    ),
    Err: (e: Error) => (
      <Lab.Alert severity="error">{e?.message || 'Unexpected state'}</Lab.Alert>
    ),
    _: () => <Lab.Alert severity="error">Unexpected state</Lab.Alert>,
  })(result)
}
