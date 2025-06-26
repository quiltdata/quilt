import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from '../model'

import ExpandingContainer from './Container'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'fixed',
    left: '50%',
    bottom: t.spacing(3),
    transform: `translateX(-50%)`,
    animation: t.transitions.create('$slide'),
  },
  button: {
    background: t.palette.background.paper,

    // Collapse parent
    position: 'absolute',
    bottom: 0,
  },
  icon: {
    marginRight: t.spacing(1),
  },
  '@keyframes slide': {
    '0%': {
      transform: `translate(-50%, ${t.spacing(2)}px)`,
    },
    '100%': {
      transform: 'translate(-50%, 0)',
    },
  },
}))

function Inner() {
  const classes = useStyles()
  const model = SearchUIModel.use()
  const onClick = React.useCallback(
    () => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }),
    [],
  )
  return (
    <ExpandingContainer className={classes.root} state={model.state}>
      <M.Fab className={classes.button} onClick={onClick} variant="extended">
        <M.Icon className={classes.icon}>expand_less</M.Icon>
        Scroll to the top
      </M.Fab>
    </ExpandingContainer>
  )
}

export default function ScrollToTop() {
  const trigger = M.useScrollTrigger({ disableHysteresis: true })
  return trigger ? <Inner /> : null
}
