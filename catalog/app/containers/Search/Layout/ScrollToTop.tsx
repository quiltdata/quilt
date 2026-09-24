import * as React from 'react'
import * as M from '@material-ui/core'

import * as Layout from 'components/Layout'
import * as Column from 'components/Layout/Column'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'fixed',
    left: '50%',
    bottom: `calc(${t.spacing(3)}px + env(safe-area-inset-bottom))`,
    transform: `translateX(-50%)`,
    animation: t.transitions.create('$slide'),
    zIndex: 1,
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
  const column = Column.useElement()
  const onClick = React.useCallback(
    () => (column ?? window).scrollTo({ top: 0, left: 0, behavior: 'smooth' }),
    [column],
  )
  return (
    <Layout.Container className={classes.root}>
      <M.Fab className={classes.button} onClick={onClick} variant="extended">
        <M.Icon className={classes.icon}>expand_less</M.Icon>
        Scroll to the top
      </M.Fab>
    </Layout.Container>
  )
}

export default function ScrollToTop() {
  const column = Column.useElement()
  const trigger = M.useScrollTrigger({
    disableHysteresis: true,
    target: column ?? undefined,
  })
  return trigger ? <Inner /> : null
}
