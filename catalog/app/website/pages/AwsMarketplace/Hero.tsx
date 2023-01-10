import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { useTalkToUs } from 'components/TalkToUs'

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
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    marginBottom: t.spacing(4),
  },
  button: {
    minWidth: t.spacing(26),
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  links: {
    textAlign: 'center',
  },
  link: {
    color: t.palette.text.primary,
    fontSize: '16px',
    lineHeight: '32px',
    '&:hover $linkIcon': {
      left: '2px',
    },
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  linkIcon: {
    color: t.palette.primary.main,
    position: 'relative',
    verticalAlign: 'middle',
  },
}))

interface MainActionsProps {
  className?: string
}

export default function MainActions({ className }: MainActionsProps) {
  const classes = useStyles()
  const bookIntro = useTalkToUs({ src: 'intro' })
  const bookDemo = useTalkToUs()
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.logos} />
      <M.Typography className={classes.tagline}>
        Effective data management is crucial for successful scientific research,
        as it allows researchers to retain knowledge from past experiments and use it to
        plan future ones. Quilt makes it easy to apply best practice standards of FLAIR
        principles (findable, linkable, accessible, interoperable, reusable) to help
        organizations better manage and find the data that they’ve created.
      </M.Typography>
      <div className={classes.buttons}>
        <M.Button
          className={classes.button}
          variant="contained"
          color="primary"
          onClick={bookIntro}
        >
          Intro to customer
        </M.Button>
        <M.Button
          className={classes.button}
          variant="contained"
          color="primary"
          onClick={bookDemo}
        >
          Book a demo
        </M.Button>
      </div>
      <div className={classes.links}>
        <a className={classes.link} href="mailto:sales@quiltdata.io">
          Email us
          <M.Icon className={classes.linkIcon} color="inherit">
            chevron_right
          </M.Icon>
        </a>
        <a className={classes.link} href="#" target="_blank">
          One Pager (PDF)
          <M.Icon className={classes.linkIcon} color="inherit">
            chevron_right
          </M.Icon>
        </a>
        <a className={classes.link} href="#" target="_blank">
          Marketplace Listing
          <M.Icon className={classes.linkIcon} color="inherit">
            chevron_right
          </M.Icon>
        </a>
      </div>
    </div>
  )
}
