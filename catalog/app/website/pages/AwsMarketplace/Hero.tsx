import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { useTalkToUs } from 'components/TalkToUs'
import ChevronLink from 'website/components/ChevronLink'

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
