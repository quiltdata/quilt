import * as React from 'react'
import * as M from '@material-ui/core'

import { useTalkToUs } from 'components/TalkToUs'
import MetaTitle from 'utils/MetaTitle'

import AwsPartner from 'website/components/AwsPartner'
import CaseStudies from 'website/pages/Landing/CaseStudies'
import Dots from 'website/components/Backgrounds/Dots'
import ChevronLink from 'website/components/ChevronLink'
import LogosCarousel from 'website/pages/Landing/LogosCarousel'
import Layout from 'website/components/Layout'
import Lede from 'website/components/Lede'
import Section from 'website/components/Section'
import Tabs from 'website/components/Tabs'

import logoAllencell from 'website/pages/Landing/Logos/logo-allencell.png'
import logoCelsius from 'website/pages/Landing/Logos/logo-celsius.png'
import logoNeumora from 'website/pages/Landing/Logos/logo-neumora.png'
import logoObsidian from 'website/pages/Landing/Logos/logo-obsidian.png'
import logoStemson from 'website/pages/Landing/Logos/logo-stemson.png'
import logoVir from 'website/pages/Landing/Logos/logo-vir.png'

const SALES_ADDRESS = 'mailto:sales@quiltdata.io'
const DECK_URL =
  'https://quilt-web-public.s3.amazonaws.com/deck/Quilt%E2%80%94the+data+hub+for+biotech.pdf'

const logos = [
  {
    src: logoCelsius,
    title: 'Celsius Therapeutics',
  },
  {
    src: logoVir,
    title: 'Vir Bio',
  },
  {
    src: logoNeumora,
    title: 'Neumora Therapeutics',
  },
  {
    src: logoObsidian,
    title: 'Obsidian Therapeutics',
  },
  {
    src: logoStemson,
    title: 'Stemson Therapeutics',
  },
  {
    src: logoAllencell,
    title: 'Allen Institute for Cell Science',
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
          src="https://www.youtube.com/embed/ykmvxb_kTc4"
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
      <Lede
        variant="flying"
        heading={<>Your data are growing</>}
        detail={
          <>
            Your company rapidly accumulates data from instruments, CROs, scientists, and
            computational pipelines. But simply storing data adds cost without benefit.
            Data without context (labels, documentation, links, and charts) quickly
            becomes meaningless. Decision quality suffers, experiments are needlessly
            repeated, and teams waste months doing "data archaeology" to reconstruct past
            results.
          </>
        }
      />
      <Lede
        heading={
          <>
            You need FAIR data, <br />
            powered by Amazon S3
          </>
        }
        detail={
          <>
            Quilt is a <em>scientific data management system (SDMS)</em> that stores,
            tags, manages, and integrates data sources so that all of your data are FAIR:
            findable, accessible, interoperable, and reusable.
            <br />
            <br />
            Quilt is delivered as a CloudFormation stack that runs privately in your AWS
            account.&nbsp;
            <strong>
              Quilt is powered by scalable and secure services like Amazon S3, Amazon
              OpenSearch, Amazon Athena.
            </strong>
            &nbsp; With Quilt, your data remain in your account, in open file formats, in
            you Amazon S3 buckets, under IAM policies that you control.
            <br />
            <br />
            Watch Alex Bangs, CIO of Vir Biotechnology, explain how his team built a
            scientific data management on Quilt and AWS. Vir Bio is a commercial-stage
            immunology company focused on combining immunologic insights with cutting-edge
            technologies to treat and prevent serious infectious diseases.
          </>
        }
      />
      <Section>
        <Video />
      </Section>
      <Lede
        heading={<>Run with a proven partner</>}
        detail={
          <>
            <AwsPartner style={{ height: '300px', float: 'left', marginRight: '32px' }} />
            As an AWS Advanced Technology Partner, the Quilt solution and Quilt team
            demonstrate deep knowledge, experience, and customer success with Amazon Web
            Services. Below are a few of Quilt's life science customers and case studies.
          </>
        }
      />
      <LogosCarousel
        logos={logos}
        title="The life sciences trust Quilt for data management"
      />
      <CaseStudies />
      <Lede
        variant="center"
        heading="Quilt transforms data into discoveries"
        detail={
          <>
            Quilt integrates data sources so that everyone is on the same page with the
            latest and most accurate data. Teams with Quilt as their SDMS leverage all
            their organizational knowledge into credible decisions —and bring drugs and
            therapies to market faster.
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
                <>Ensure that every dataset has an immutable version that can be</>,
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

      <M.Box pt={2} />
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
