import * as React from 'react'
import * as M from '@material-ui/core'

import { useTalkToUs } from 'components/TalkToUs'
import MetaTitle from 'utils/MetaTitle'

import O1 from 'website/components/Backgrounds/Overlay1Full'
import O2 from 'website/components/Backgrounds/Overlay2'
import Dots from 'website/components/Backgrounds/Dots'
import ChevronLink from 'website/components/ChevronLink'
import Layout from 'website/components/Layout'
import Tabs from 'website/components/Tabs'
import Videos from 'website/components/Videos'

import { Title, SectionContainer } from './Example'

const SALES_ADDRESS = 'mailto:sales@quiltdata.io'

function BioIT() {
  const talk = useTalkToUs({ src: 'bioit' })
  return (
    <>
      {/* TODO: title? */}
      <MetaTitle>Quilt @ Bio-IT World</MetaTitle>
      <Dots />
      <O1 />
      <O2 />
      <Title
        // TODO: image
        primary="Your data is depreciating because it lacks context"
        secondary={
          <>
            Your team is rapidly accumulating data from instruments, CROs, scientists, and
            executives. But naively storing data adds cost without benefit. Data without
            context (labels, documentation, links, and charts) quickly becomes
            meaningless. Decision quality suffers, experiments are needlessly repeated,
            and teams waste months doing "data archaeology" on past results.
          </>
        }
      >
        <M.Box mt={2}>
          <M.Button variant="contained" color="primary" onClick={talk}>
            Schedule a demo
          </M.Button>
        </M.Box>
        <M.Box mt={3}>
          <ChevronLink href={SALES_ADDRESS}>Ask a question</ChevronLink>
        </M.Box>
      </Title>

      <Title
        center
        primary="Data hubs illuminate your data with context"
        secondary={
          <>
            Data hubs integrate data sources so that everyone is on the same page with the
            latest and most accurate data. Teams with data hubs make informed decisions
            faster—and get drugs, targets, and therapies to market faster.
          </>
        }
      />

      <SectionContainer>
        <M.Box pt={5} />
        <Tabs
          sections={[
            {
              title: 'Benefits',
              bullets: [
                <>Trust and act upon your results with confidence</>,
                <>
                  Know who, when, why, and how for every file your company creates produce
                </>,
                <>Make informed decisions faster from a single source of truth</>,
                <>
                  Spend less time and money on custom infrastructure (Quilt gives a 6-9
                  month head start on your scientific data infrastructure)
                </>,
                <>
                  Ensure that every dataset is reproducible (via versioning) and
                  discoverable, via search
                </>,
              ],
            },
            {
              title: 'Security and scale',
              bullets: [
                <>The Quilt Data Hub runs in your Virtual Private Cloud (VPC)</>,
                <>Integrates with Single Sign-On (SSO)</>,
                <>Integrates with Amazon S3 for limitless storage</>,
                <>You set the security policies via Amazon IAM</>,
              ],
            },
            {
              title: 'Use cases',
              bullets: [
                <>Connect large datasets to any ELN or LIMS system with a single URL</>,
                <>Schedule pipelines to run in a single click (e.g. CRISPResso2)</>,
                <>
                  Version data and models for rapid iteration in statistics and machine
                  learning
                </>,
                <>
                  Automate screens to analyze data (e.g. FASTQs), produce charts, and
                  eliminate meetings and PowerPoint presentations
                </>,
                <>
                  Bench science and data science can collaboratively annotate and document
                  datasets for reuse
                </>,
                <>
                  Longitudinally query all experiments of a given type with SQL, Python,
                  or natural language search
                </>,
              ],
            },
          ]}
        />
      </SectionContainer>

      <Videos bare />

      <SectionContainer>
        <M.Box display="flex" flexDirection="column" alignItems="center" pb={15} pt={5}>
          <M.Box mt={2}>
            <M.Button variant="contained" color="primary" onClick={talk}>
              Schedule a demo
            </M.Button>
          </M.Box>
          <M.Box mt={3}>
            <ChevronLink href={SALES_ADDRESS}>Ask a question</ChevronLink>
          </M.Box>
        </M.Box>
      </SectionContainer>

      {/* TODO: sticky footer? */}
    </>
  )
}

export default function BioITWrapper() {
  // Layout injects TalkToUs provider into the component tree
  // (required for BioIT component)
  return (
    <Layout>
      <BioIT />
    </Layout>
  )
}
