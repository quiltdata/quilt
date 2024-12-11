import * as React from 'react'

import Skeleton from './Skeleton'

const RenderLazy = React.lazy(() => import('./Render'))

export { default as Skeleton } from './Skeleton'

export function Render(props: Parameters<typeof RenderLazy>[0]) {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <RenderLazy {...props} />
    </React.Suspense>
  )
}
