import * as React from 'react'
import * as M from '@material-ui/core'

import { createBoundary } from 'utils/ErrorBoundary'
import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import type { NglProps } from './Ngl'

function NglError() {
  return <M.Typography>Error rendering file (we couldn't parse this file)</M.Typography>
}

const ErrorBoundary = createBoundary(() => () => <NglError />)

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Ngl = RT.mkLazy(() => import('./Ngl'), SuspensePlaceholder)

export default (data: NglProps, props: NglProps) => (
  <ErrorBoundary>
    <Ngl {...data} {...props} />
  </ErrorBoundary>
)
