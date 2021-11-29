import * as React from 'react'
import * as M from '@material-ui/core'

import { useTalkToUs } from 'components/TalkToUs'
import MetaTitle from 'utils/MetaTitle'

import Dots from 'website/components/Backgrounds/Dots'
import ChevronLink from 'website/components/ChevronLink'
import LogosCarousel from 'website/pages/Landing/LogosCarousel'
import Layout from 'website/components/Layout'
import Lede from 'website/components/Lede'
import Section from 'website/components/Section'
import Tabs from 'website/components/Tabs'

import logoAics from 'website/pages/Landing/Logos/logo-aics.png'
import logoCelsius from 'website/pages/Landing/Logos/logo-celsius.png'
import logoHudl from 'website/pages/Landing/Logos/logo-hudl.png'
import logoRibon from 'website/pages/Landing/Logos/logo-ribon.png'
import logoSight from 'website/pages/Landing/Logos/logo-sight.png'
import logoAI2 from 'website/pages/Landing/Logos/logo-ai2.png'
import logoNetguru from 'website/pages/Landing/Logos/logo-netguru.png'
import logoBT from 'website/pages/Landing/Logos/logo-bt.png'
import logoZee5 from 'website/pages/Landing/Logos/logo-zee5.png'

const SALES_ADDRESS = 'mailto:sales@quiltdata.io'
const DECK_URL =
  'https://quilt-web-public.s3.amazonaws.com/deck/Quilt%E2%80%94the+data+hub+for+biotech.pdf'

const logos = [
  {
    src: logoAics,
    title: 'Allen Institute for Cell Science',
  },
  {
    src: logoBT,
    title: 'BlackThorn Therapeutics',
  },
  {
    src: logoHudl,
    title: 'hudl',
  },
  {
    src: logoAI2,
    title: 'Allen Institute for AI',
  },
  {
    src: logoCelsius,
    title: 'Celsius',
  },
  {
    src: logoRibon,
    title: 'Ribon Therapeutics',
  },
  {
    src: logoSight,
    title: 'Sighthound',
  },
  {
    src: logoNetguru,
    title: 'Netguru',
  },
  {
    src: logoZee5,
    title: 'Zee5',
  },
]

function Video() {
  return (
    <M.Box alignItems="center" display="flex" flexDirection="column" pb={8} pt={8}>
      <M.Box
        position="relative"
        maxWidth={900}
        width="100%"
        bgcolor="common.black"
        pb="56.25%"
      >
        <iframe
          frameBorder="0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            height: '100%',
            width: '100%',
          }}
          src="https://www.youtube.com/embed/wDgPvwUD84I?list=PLmXfD6KoA_vBtgGgt0X4ui4cRlEkdJKp9"
        />
      </M.Box>
    </M.Box>
  )
}

function BioIT() {
  const talk = useTalkToUs({ src: 'bioit' })
  return (
    <>
      <MetaTitle />
      <Dots />
      <M.Box pt={10} />
      <Lede
        variant="flying"
        heading={<>Get bench science and data science on the same page</>}
        detail={
          <>
            Your team is rapidly accumulating data from instruments, CROs, scientists, and
            executives. But naively storing data adds cost without benefit. Data without
            context (labels, documentation, links, and charts) quickly becomes
            meaningless. Decision quality suffers, experiments are needlessly repeated,
            and teams waste months doing "data archaeology" on past results.
          </>
        }
        cta={
          <M.Button variant="contained" color="primary" onClick={talk}>
            Schedule a demo
          </M.Button>
        }
        link={
          <>
            <ChevronLink href={SALES_ADDRESS}>Email us</ChevronLink>
            <M.Box pt={2} />
            <ChevronLink href={DECK_URL}>Get the deck (PDF)</ChevronLink>
          </>
        }
      />
      <M.Box pt={{ xs: 3, md: 25 }} />
      <Lede
        variant="center"
        heading="Data hubs make data appreciate in value"
        detail={
          <>
            Data hubs integrate data sources so that everyone is on the same page with the
            latest and most accurate data. Teams with data hubs make informed decisions
            faster—and get drugs, targets, and therapies to market on time.
            <br />
            <br />
            Data hubs do what data lakes, databases, data catalogs, data warehouses, and
            notebooks cannot: link to large data in any format.
          </>
        }
      />

      <Section>
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
                  Spend less time and money on custom infrastructure (Quilt gives you a
                  six to nine month head start)
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
      </Section>

      <LogosCarousel logos={logos} />

      <M.Box pt={2} />
      <Section bg="fancy">
        <Video />
      </Section>

      <Section>
        <M.Box display="flex" flexDirection="column" alignItems="center" pb={15} pt={7}>
          <M.Button variant="contained" color="primary" onClick={talk}>
            Schedule a demo
          </M.Button>
          <M.Box pt={3} />
          <ChevronLink href={SALES_ADDRESS}>Email us</ChevronLink>
          <M.Box pt={2} />
          <ChevronLink href={DECK_URL}>Get the deck (PDF)</ChevronLink>
        </M.Box>
      </Section>
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
