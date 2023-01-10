import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import logos from './logos.svg'

const useStyles = M.makeStyles((t) => ({
  root: {
    maxWidth: '546px',
  },
  logos: {
    background: `50% 50% url("${logos}") no-repeat`,
    height: '99px',
    marginBottom: t.spacing(6),
  },
  tagline: {
    color: t.palette.text.secondary,
    marginBottom: t.spacing(3),
  },
  buttons: {
    marginBottom: t.spacing(4),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: {},
}))

interface MainActionsProps {
  className?: string
}

export default function MainActions({ className }: MainActionsProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.logos} />
      <M.Typography className={classes.tagline}>
        Effective data management is crucial for successful scientific research, as it
        allows researchers to retain knowledge from past experiments and use it to plan
        future ones. Quilt makes it easy to apply best practice standards of FLAIR
        principles (findable, linkable, accessible, interoperable, reusable) to help
        organizations better manage and find the data that they’ve created.
      </M.Typography>
      <div className={classes.buttons}>
        <M.Button variant="contained" color="primary">
          Intro to customer
        </M.Button>
        <M.Button variant="contained" color="primary">
          Book a demo
        </M.Button>
      </div>
      <div className={classes.links}></div>
    </div>
  )
}
