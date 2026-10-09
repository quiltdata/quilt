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

function Deferred({ handle }: { handle: Model.S3.S3ObjectLocation }) {
  const [open, setOpen] = React.useState(false)
  return open ? (
    <Viewer handle={handle} />
  ) : (
    <M.Button variant="outlined" size="small" onClick={() => setOpen(true)}>
      Open OME-Zarr viewer
    </M.Button>
  )
}

export default function ZarrWrapper(
  { handle, deferred }: { handle: Model.S3.S3ObjectLocation; deferred?: boolean },
  props: React.HTMLAttributes<HTMLDivElement>,
) {
  return (
    <ErrorBoundary FallbackComponent={ZarrError}>
      <div {...props}>
        {deferred ? (
          // Keyed so a reused row does not carry an earlier store's open state.
          <Deferred
            key={`${handle.bucket}/${handle.key}/${handle.version}`}
            handle={handle}
          />
        ) : (
          <Viewer handle={handle} />
        )}
      </div>
    </ErrorBoundary>
  )
}
