import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from '../model'

import ExpandingContainer from './Container'

const useScrollToTopStyles = M.makeStyles((t) => ({
  root: {
    position: 'fixed',
    left: '50%',
    bottom: t.spacing(3),
    transform: `translateX(-50%)`,
  },
  button: {
    background: t.palette.background.paper,
  },
  icon: {
    marginRight: t.spacing(1),
  },
}))

export default function ScrollToTop() {
  const model = SearchUIModel.use()
  const trigger = M.useScrollTrigger({ disableHysteresis: true })
  const classes = useScrollToTopStyles()
  const onClick = React.useCallback(
    () => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }),
    [],
  )
  return (
    <M.Fade in={!!trigger}>
      <ExpandingContainer className={classes.root} state={model.state}>
        <M.Fab className={classes.button} onClick={onClick} variant="extended">
          <M.Icon className={classes.icon}>expand_less</M.Icon>
          Scroll to the top
        </M.Fab>
      </ExpandingContainer>
    </M.Fade>
  )
}
