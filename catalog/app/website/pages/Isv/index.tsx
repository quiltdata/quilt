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

const useStyles = M.makeStyles((t) => ({
  main: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    padding: t.spacing(25, 0, 28),
  },
}))

function ISV() {
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
    </div>
  )
}

export default function ISVWrapper() {
  // Layout injects TalkToUs provider into the component tree
  // (required for ISV component)
  return (
    <Layout>
      <MetaTitle />
      <ISV />
    </Layout>
  )
}
