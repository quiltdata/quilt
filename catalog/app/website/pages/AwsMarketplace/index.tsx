import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import AWS from './AWS'
import CaseStudies from './CaseStudies'
import Features from './Features'
import Hero from './Hero'
import Form from './Form'
import Partners from './Partners'

const useAttributionStyles = M.makeStyles((t) => ({
  root: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
    color: t.palette.text.disabled,
  },
  text: {
    padding: t.spacing(1, 0),
    textAlign: 'center',
  },
}))

interface AttributionProps {
  className: string
}

function Attribution({ className }: AttributionProps) {
  const classes = useAttributionStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Container maxWidth="lg">
        <M.Typography className={classes.text} variant="caption" component="p">
          Icons used: “
          <a href="https://thenounproject.com/icon/data-sharing-5406825/">Data Sharing</a>
          ” by Candy Design “
          <a href="https://thenounproject.com/icon/upload-database-322726/">
            Upload Database
          </a>
          ” by Smashicons “
          <a href="https://thenounproject.com/icon/data-visualization-5039056/">
            data visualization
          </a>
          ” by SAM Designs from Noun Project
        </M.Typography>
      </M.Container>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  main: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    padding: t.spacing(25, 0, 28),
  },
  attribution: {
    marginTop: t.spacing(16),
  },
}))

function AwsMarketplace() {
  const classes = useStyles()
  return (
    <div>
      <M.Container maxWidth="lg" className={classes.main}>
        <Hero />
        <Form />
      </M.Container>
      <M.Container maxWidth="lg">
        <Features />
      </M.Container>
      <Partners />
      <CaseStudies />
      <M.Container maxWidth="lg">
        <AWS />
      </M.Container>
      <Attribution className={classes.attribution} />
    </div>
  )
}

export default function AwsMarketplaceWrapper() {
  // Layout injects TalkToUs provider into the component tree
  // (required for AwsMarketplace component)
  return (
    <Layout>
      <MetaTitle />
      <AwsMarketplace />
    </Layout>
  )
}
