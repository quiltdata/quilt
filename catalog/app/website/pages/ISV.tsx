import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import AWS from './Isv/AWS'
import CaseStudies from './Isv/CaseStudies'
import Features from './Isv/Features'
import MainActions from './Isv/MainActions'
import Partners from './Isv/Partners'

const useStyles = M.makeStyles((t) => ({
  mainActions: {},
}))

function ISV() {
  const classes = useStyles()
  return (
    <div>
      <MainActions className={classes.mainActions} />
      <Features />
      <Partners />
      <CaseStudies />
      <AWS />
    </div>
  )
}

export default function ISVWrapper() {
  // Layout injects TalkToUs provider into the component tree
  // (required for BioIT component)
  return (
    <Layout>
      <MetaTitle />
      <ISV />
    </Layout>
  )
}
