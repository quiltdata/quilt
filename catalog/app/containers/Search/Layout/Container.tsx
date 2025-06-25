import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from 'containers/Search/model'

export function useMobileView() {
  const t = M.useTheme()
  return M.useMediaQuery(t.breakpoints.down('sm'))
}

const useExpandingContainerStyles = M.makeStyles((t) => ({
  [SearchUIModel.View.Table]: {
    animation: t.transitions.create('$expand'),
  },
  [SearchUIModel.View.List]: {
    animation: t.transitions.create('$collapse'),
  },
  '@keyframes expand': {
    '0%': {
      transform: 'scaleX(0.94)',
    },
    '100%': {
      transform: 'scaleX(1)',
    },
  },
  '@keyframes collapse': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: 1,
    },
  },
}))

interface ExpandingContainerProps {
  children: NonNullable<React.ReactNode>
  className?: string
  state: SearchUIModel.SearchUrlState
}

export default function ExpandingContainer({
  className,
  state,
  children,
}: ExpandingContainerProps) {
  const classes = useExpandingContainerStyles()
  return (
    <M.Container
      className={cx(classes[state.view], className)}
      maxWidth={state.view === SearchUIModel.View.Table ? false : 'lg'}
    >
      {children}
    </M.Container>
  )
}
