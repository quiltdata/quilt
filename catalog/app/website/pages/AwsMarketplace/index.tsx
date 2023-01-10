import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import Attribution from './Attribution'
import AwsPartner from './AwsPartner'
import CaseStudies from './CaseStudies'
import Features from './Features'
import Form from './Form'
import Hero from './Hero'
import Partners from './Partners'

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
        <AwsPartner />
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
