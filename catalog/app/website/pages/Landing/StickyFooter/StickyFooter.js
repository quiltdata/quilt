import * as React from 'react'
import * as M from '@material-ui/core'

import { useExperiments } from 'components/Experiments'
import { useTalkToUs } from 'components/TalkToUs'

const useStyles = M.makeStyles((t) => ({
  root: {
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'fixed',
    right: 0,
    zIndex: 1,
  },
  container: {
    alignItems: 'center',
    background: 'linear-gradient(to right, #2b2e68, #383a89)',
    borderTop: '#f6a598 2px solid',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    boxShadow: '0 16px 16px 12px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    marginLeft: -8,
    marginRight: -8,
    paddingBottom: t.spacing(1.5),
    paddingLeft: t.spacing(3),
    paddingRight: t.spacing(3),
    paddingTop: t.spacing(1.5),
  },
  text: {
    ...t.typography.body1,
    color: t.palette.text.primary,
    lineHeight: '20px',
    paddingLeft: t.spacing(8),
    paddingRight: t.spacing(8),
    textAlign: 'center',
    textShadow: '0 2px 8px #000',
    [t.breakpoints.down('sm')]: {
      paddingLeft: 0,
      paddingRight: t.spacing(2),
    },
  },
}))

export default function StickyFooter() {
  const classes = useStyles()
  const cta = useExperiments('cta')
  const talk = useTalkToUs()
  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <div className={classes.text}>{cta}</div>
        <M.Button variant="contained" color="secondary" onClick={talk}>
          <M.Box component="span" whiteSpace="nowrap">
            Talk To Us
          </M.Box>
        </M.Button>
      </div>
    </div>
  )
}
