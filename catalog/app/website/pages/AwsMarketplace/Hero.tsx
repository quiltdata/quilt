import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { useTalkToUs } from 'components/TalkToUs'
import ChevronLink from 'website/components/ChevronLink'

import logos from './logos.svg'

const QUILT_PROFILE_URL =
  'https://aws.amazon.com/marketplace/seller-profile?id=865bcbb9-ae88-4eed-8cfe-c58948910e53'

const useStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.up('sm')]: {
      maxWidth: '546px',
    },
  },
  logos: {
    background: `50% 50% / contain url("${logos}") no-repeat`,
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
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  button: {
    '& + &': {
      [t.breakpoints.up('sm')]: {
        marginLeft: t.spacing(3),
      },
      [t.breakpoints.down('sm')]: {
        marginTop: t.spacing(1),
      },
    },
  },
  buttonOutlined: {
    padding: '7px 15px',
  },
  links: {
    textAlign: 'center',
  },
  link: {
    alignItems: 'center',
    display: 'inline-flex',
    fontSize: '16px',
    lineHeight: '32px',
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
}))

interface HeroProps {
  className?: string
}

export default function Hero({ className }: HeroProps) {
  const classes = useStyles()
  const bookIntro = useTalkToUs({ src: 'awsmarketplace' })
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
        <a className={classes.button} href={QUILT_PROFILE_URL} target="_blank">
          <M.Button color="primary">Install Quilt</M.Button>
        </a>
        <M.Button
          className={cx(classes.button, classes.buttonOutlined)}
          variant="contained"
          color="primary"
          onClick={bookDemo}
        >
          Book a demo
        </M.Button>
      </div>
      <div className={classes.links}>
        <ChevronLink
          className={classes.link}
          href="mailto:sales@quiltdata.io"
          target="_blank"
        >
          Email us
        </ChevronLink>
        <ChevronLink
          className={classes.link}
          href="https://quilt-sales-public.s3.amazonaws.com/Quilt_One_Pager_ReInvent_2022.pdf"
          target="_blank"
        >
          One Pager (PDF)
        </ChevronLink>
        <ChevronLink
          className={classes.link}
          href="https://aws.amazon.com/marketplace/seller-profile?id=865bcbb9-ae88-4eed-8cfe-c58948910e53"
          target="_blank"
        >
          Marketplace Listing
        </ChevronLink>
      </div>
    </div>
  )
}
