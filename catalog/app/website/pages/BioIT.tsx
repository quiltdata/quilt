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
            computational pipelines. But simply storing data brings cost without benefit.
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
            Gain confident control
            <br />
            with a cloud SDMS
          </>
        }
        detail={
          <>
            Quilt is a <em>scientific data management system (SDMS)</em> that stores,
            tags, manages, and integrates data sources so that all of your data are FAIR:
            findable, accessible, interoperable, and reusable.
            <br />
            <br />
            Quilt runs privately and securely in your AWS account, as a CloudFormation
            stack.&nbsp;
            <strong>
              Quilt is powered by scalable and secure services like Amazon S3, Amazon
              OpenSearch, Amazon Athena, and Amazon Lambda.
            </strong>
            &nbsp;Quilt stores your data in open file formats, in your Amazon S3 buckets,
            under IAM policies that you control.
            <br />
            <br />
            Watch Alex Bangs, CIO of Vir Biotechnology, explain how he deployed Vir's
            scientific data management system on Quilt and AWS. Vir Bio is a
            commercial-stage immunology company focused on combining immunologic insights
            with cutting-edge technologies to treat and prevent serious infectious
            diseases.
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
            <AwsPartner style={{ height: '256px', float: 'left', marginRight: '32px' }} />
            As an AWS Advanced Technology Partner, the Quilt solution and Quilt team
            demonstrate deep knowledge, experience, and customer success with Amazon Web
            Services. Below are a few of Quilt's life science customers, followed by case
            studies.
          </>
        }
        maxWidth="55rem"
      />
      <LogosCarousel
        logos={logos}
        title="Life scientists trust Quilt for data management"
      />
      <CaseStudies />
      <Lede
        variant="center"
        heading="Quilt transforms data into discoveries"
        detail={
          <>
            Quilt integrates data sources so that everyone is on the same page with the
            latest and most accurate data. Teams with Quilt as their SDMS leverage all of
            their organizational knowledge into credible decisions—bringing drugs and
            therapies to market faster.
          </>
        }
      />
      <Section>
        <M.Box pt={5} />
        <Tabs
          sections={[
            {
              title: 'Use cases',
              bullets: [
                <>Link large datasets to any ELN or LIMS system with a single URL</>,
                <>Schedule pipelines to run in a single click (e.g. CRISPResso2)</>,
                <>
                  Confidently capture data, metadata, and documentation as immutable
                  collections, known as Quilt packages
                </>,
                <>
                  Automate pipelines to analyze data (e.g. FASTQs), produce charts, and
                  notify collaborators as soon as the results are ready (reducing the need
                  for tedious meetings and slide presentations)
                </>,
                <>
                  Share charts and visualizations on the web—no backend coding required
                </>,
                <>Collaboratively create, tag, and document datasets for FAIR reuse</>,
                <>
                  Longitudinally query all experiments of a given type with SQL, Python,
                  or natural language search
                </>,
              ],
            },

            {
              title: 'Benefits',
              bullets: [
                <>
                  Know who, when, why, and how for every piece of data your company
                  creates
                </>,
                <>
                  Make informed decisions faster from a single, trusted source of truth
                </>,
                <>Ensure that your data are FAIR for decades to come</>,
                <>
                  Trust immutable data versions to losslessly retain data and knowledge
                </>,
              ],
            },
            {
              title: 'Security and scale',
              bullets: [
                <>Quilt runs in your Virtual Private Cloud (VPC)</>,
                <>Integrates with Single Sign-On (SSO)</>,
                <>Integrates with Amazon S3 for limitless storage</>,
                <>You set the security policies via Amazon IAM</>,
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
          <ChevronLink href={SALES_ADDRESS}>Email us a question</ChevronLink>
          <M.Box pt={2} />
          <ChevronLink href={DECK_URL}>
            Learn more about Quilt for life sciences (PDF)
          </ChevronLink>
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
