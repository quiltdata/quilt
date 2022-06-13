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

import imageArch from 'website/pages/Landing/Assets/quilt-architecture.png'
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
const useVideoStyles = M.makeStyles({
  wrapper: {
    maxWidth: '900px',
    width: '100%',
  },
  video: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
})

function Video() {
  const classes = useVideoStyles()
  return (
    <M.Box alignItems="center" display="flex" flexDirection="column" pb={8} pt={8}>
      <div className={classes.wrapper}>
        <M.Box
          position="relative"
          maxWidth={900}
          width="100%"
          bgcolor="common.black"
          pb="56.25%"
        >
          <iframe
            className={classes.video}
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            src="https://www.youtube.com/embed/ykmvxb_kTc4"
          />
        </M.Box>
      </div>
    </M.Box>
  )
}

const useBioITStyles = M.makeStyles((t) => ({
  awsPartner: {
    display: 'block',
    maxWidth: '70%',
    margin: t.spacing(0, 'auto', 2),
    [t.breakpoints.up('sm')]: {
      float: 'left',
      height: t.spacing(32),
      margin: t.spacing(0, 2, 0, 0),
    },
  },
}))

function BioIT() {
  const talk = useTalkToUs({ src: 'bioit' })
  const classes = useBioITStyles()
  return (
    <>
      <MetaTitle />
      <Dots />
      <Lede
        variant="flying"
        heading={
          <>
            Transform data into discoveries
            <br />
            with Quilt + Amazon S3
          </>
        }
        detail={
          <>
            Quilt stores, tags, manages, and integrates your data sources so that all of
            your data are findable, accessible, interoperable, and reusable (FAIR).
            Publicly traded companies in life sciences choose Quilt as their{' '}
            <strong>scientific data management system (SDMS) </strong>to leverage all of
            their organizational knowledge into credible decisions that bring drugs and
            therapies to market faster.
            <M.Box pt={4} />
            Quilt runs privately and securely in your AWS account, as a CloudFormation
            stack.&nbsp;
            <strong>
              Quilt is powered by scalable and secure services like Amazon S3, Amazon
              OpenSearch, and Amazon Athena.
            </strong>
            <M.Box display="flex" flexDirection="column" pt={6}>
              <M.Button variant="contained" color="primary" onClick={talk}>
                Book a demo
              </M.Button>
            </M.Box>
            <M.Box pt={2} />
            <ChevronLink href={DECK_URL}>
              Learn more about Quilt for life sciences (PDF)
            </ChevronLink>
          </>
        }
      />
      <M.Box pb={{ xs: 0, md: 10 }} />
      <Section>
        <Tabs
          sections={[
            {
              title: 'Use cases',
              bullets: [
                <>
                  Link large datasets to any notebook, ELN, or lab information management
                  system (LIMS) with immutable URLs
                </>,
                <>Find, document, and understand all of your data in a central catalog</>,
                <>Schedule pipelines to run in a single click (e.g. CRISPResso2)</>,
                <>
                  Confidently capture data, metadata, and documentation in immutable
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
                  Longitudinally query all experiments with natural language, SQL, or
                  Python
                </>,
              ],
            },
            {
              title: 'Benefits',
              bullets: [
                <>
                  Know the lineage and provenance of every datum your company creates
                  (who, when, where, why, and how)
                </>,
                <>
                  Make informed decisions faster from a single, trusted source of truth
                </>,
                <>Ensure that your data are FAIR for decades to come</>,
                <>
                  Trust immutable data versions to preserve data and knowledge over
                  decades
                </>,
              ],
            },
            {
              title: 'Security and scale',
              bullets: [
                <>Quilt runs in your Virtual Private Cloud (VPC)</>,
                <>Integrate with Single Sign-On (SSO)</>,
                <>Integrate with your VPN</>,
                <>Integrate with Amazon S3</>,
                <>Customize security policies with Amazon IAM</>,
              ],
            },
          ]}
        />
      </Section>
      <Lede
        heading={<>Your data grow wildly</>}
        variant="center"
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
        heading={<>Gain confident control with cloud data management</>}
        detail={
          <>
            Quilt stores your data in open file formats, in your Amazon S3 buckets, under
            IAM policies that you control.
            <M.Box pt={4} />
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
        heading={<>Your proven AWS partner</>}
        detail={
          <>
            <AwsPartner className={classes.awsPartner} style={{ marginRight: '32px' }} />
            As an AWS Advanced Technology Partner, the Quilt solution and Quilt team
            demonstrate deep knowledge, experience, and customer success with Amazon Web
            Services. Below are a few of Quilt's life science customers, followed by case
            studies.
            <M.Box pt={2} />
            Quilt is an AWS-native application that invokes Amazon services like S3,
            OpenSearch, Athena, Lambda, RDS, and more. See the following diagram for
            details on the Quilt solution architecture.
          </>
        }
        maxWidth="55rem"
      />
      <M.Box alignItems="center" display="flex" flexDirection="column" padding={4}>
        <img src={imageArch} width="80%" />
      </M.Box>
      <LogosCarousel logos={logos} title="Your peers trust Quilt for data management" />
      <CaseStudies />
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
