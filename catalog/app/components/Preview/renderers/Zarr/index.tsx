import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as M from '@material-ui/core'

import Placeholder from 'components/Placeholder'
import type * as Model from 'model'
import * as RT from 'utils/reactTools'

import type { ViewerProps } from './Viewer'

function ZarrError({ error }: FallbackProps) {
  return (
    <>
      <M.Typography>Unable to render OME-Zarr image.</M.Typography>
      <M.Typography variant="caption">{error?.message}</M.Typography>
    </>
  )
}

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

// Viv pulls in deck.gl/luma.gl; keep it out of the main bundle.
const Viewer: React.FC<ViewerProps> = RT.mkLazy(
  () => import('./Viewer'),
  SuspensePlaceholder,
)

export default function ZarrWrapper(
  { handle }: { handle: Model.S3.S3ObjectLocation },
  props: React.HTMLAttributes<HTMLDivElement>,
) {
  return (
    <ErrorBoundary FallbackComponent={ZarrError}>
      <div {...props}>
        <Viewer handle={handle} />
      </div>
    </ErrorBoundary>
  )
}
