import * as React from 'react'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import { createBoundary } from 'utils/ErrorBoundary'
import Placeholder from 'components/Placeholder'
import StyledLink from 'utils/StyledLink'
import * as RT from 'utils/reactTools'

import type { NglProps } from './Ngl'

function NglError() {
  const intercom = Intercom.use()
  return (
    <M.Typography>
      We couldn't parse this file. If you have such an opportunity,{' '}
      <StyledLink onClick={() => intercom('show')}>send</StyledLink> the file to our
      support
    </M.Typography>
  )
}

const ErrorBoundary = createBoundary(() => () => <NglError />)

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Ngl = RT.mkLazy(() => import('./Ngl'), SuspensePlaceholder)

export default (data: NglProps, props: NglProps) => (
  <ErrorBoundary>
    <Ngl {...data} {...props} />
  </ErrorBoundary>
)
