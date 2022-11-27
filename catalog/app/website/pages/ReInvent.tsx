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
import logoTessera from 'website/pages/Landing/Logos/logo-tessera.png'
import logoCellarity from 'website/pages/Landing/Logos/logo-cellarity.png'
//import useStyles from 'website/pages/Landing/CaseStudies'

const SALES_ADDRESS = 'mailto:sales@quiltdata.io'
const DECK_URL =
  'https://s3.amazonaws.com/quilt-sales-public/Quilt-Data_Mesh.pdf'

const logos = [
  // Rob: Needs to be turned white
  {
    src: logoTessera,
    title: 'Tessera Therapeutics'
  },
  // Rob: Needs to be turned white
  {
    src: logoCellarity,
    title: 'Cellarity'
  },
  {
    src: logoVir,
    title: 'Vir Bio',
  },
  {
    src: logoCelsius,
    title: 'Celsius Therapeutics',
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
    <M.Box alignItems="right" display="flex" flexDirection="column" pb={8} pt={8}>
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

const useReinventStyles = M.makeStyles((t) => ({
  root: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
    paddingBottom: t.spacing(12),
    paddingTop: t.spacing(10),
    position: 'relative',
  },
  studies: {
    alignItems: 'flex-start',
    display: 'flex',
    justifyContent: 'space-around',
    [t.breakpoints.down('sm')]: {
      alignItems: 'center',
      flexDirection: 'column',
    },
  },
  study: {
    display: 'grid',
    gridTemplateColumns: '128px 1fr',
    gridTemplateRows: 'auto auto auto',
    gridTemplateAreas: `
      "logo heading"
      "logo body"
      "logo link"
    `,
    gridRowGap: t.spacing(2),
    marginTop: t.spacing(7),
    maxWidth: 500,
    width: `calc(50% - ${t.spacing(6)}px)`,
    [t.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  studyHeading: {
    color: t.palette.text.primary,
    gridArea: 'heading',
    ...t.typography.h4,
  },
  studyBody: {
    color: t.palette.text.secondary,
    gridArea: 'body',
    ...t.typography.body2,
  },
  studyLink: {
    gridArea: 'link',
  },
  studyLogo: {
    backgroundRepeat: 'no-repeat',
    gridArea: 'logo',
  },
}))

const useReInventStyles = M.makeStyles((t) => ({
  awsPartner: {
    display: 'block',
    maxWidth: '70%',
    margin: t.spacing(0, 'auto', 2),
    [t.breakpoints.up('sm')]: {
      float: 'left',
      height: t.spacing(28),
      margin: t.spacing(0, 2, 0, 0),
    },
  },
}))

function ReInvent() {
  const talk = useTalkToUs({ src: 'reinvent' })
  const classes = useReInventStyles()
  return (
    <>
      <MetaTitle />
      <Dots />
      <Lede
        variant="flying"
        heading={
          <>
            Supercharge Life Sciences Collaboration
            <br />
            with Quilt Data Mesh
          </>
        }
        detail={
          <>
          {/* SRK To:Do
          Add MailChimp Form to the right, adjust the Images to suit.
          */}
            Quilt's Data Platform allows Life Sciences organizations to move fast and safe, while providing users across the organization with access to their data.
            <br />
            Our customers have likened it to a combination of Box and Github for data, but with the unlimited scalability of Amazon S3.

            Quilt gives users the power of Data Packages, which are are structure-agnostic data containers containers, and map instrument and analysis metadata to
            specific versions of massive data files (even in other buckets). They can be created and retrieved via automated integrations, shell commands, or the open-source Python API.
           <br />

          <M.Box pt={4} />
            The <strong>Quilt Data Catalog</strong> allows users to view their organizations' data beautifully displayed, supported by rich
            visualizations*, and simple but powerful search features.
          <br />
          <M.Box pt={4} />

          <M.Box mr={10}>

          Quilt runs privately and securely in your AWS account, as a
          CloudFormation stack.&nbsp;
          <strong>
            Quilt is powered by scalable and secure services like Amazon S3, Amazon
            OpenSearch, and Amazon Athena.
          </strong>
          </M.Box>
          <M.Box display="flex" flexDirection="column" pt={6}>
            <M.Button variant="contained" color="primary" onClick={talk}>
              Book a demo
            </M.Button>
          </M.Box>
          <M.Box pt={2} />

            <ChevronLink href={DECK_URL}>
            Deck: Quilt the Data Mesh for Life Sciences (PDF)
          </ChevronLink>
          </>
        }
      />
      <M.Box zIndex={1}><CaseStudies /> </M.Box>

      {/* Add Logo Carosel here */}
      <M.Box zIndex={1}>
        <LogosCarousel logos={logos} title="Life Sciences Organizations Run on Quilt" />
      </M.Box>

      {/* Breakout boxes

      Rob: I need to be able to drop images aside these items. For this first one,
      I need to be able to drop in an image to the right of this section.*/}
      <Lede
        heading={<>Data Management Democratized</>}
        variant="left"
        detail={
          <>
            Your company rapidly accumulates data from instruments, CROs, scientists, and
            computational pipelines. But simply storing data brings cost without benefit.
            Data without context (labels, documentation, links, and charts) quickly
            becomes meaningless.
            <br /> <br />
            With Quilt, your team builds your data schema from the bottom up, using Quilt’s
            rich metadata discovery and management tools. This way, everyone in the organization is empowered to
            cultivate, cleanse and enrich data into powerful Data Products which can be presented across domains,
            across the organization, or across the industry.
          </>
        }
      />
      <M.Box pb={{ xs: 0, md: 2 }} />
      {/* Rob: For this one, I'd like to be able to drop an image to the left and the right. */}
      <Lede
        heading={<>Rich Visualizations</>}
        variant="center"
        detail={
          <>
            The Quilt Data Catalog has powerful Life Science Industry specific visualizations built into it.
            <br />
             Quilt's visualization
            engine allows users to visualize the contents of files, so that they can contextualize immediately. This means
            if you run into a PDB (Protein Visualization file), we'll display a 3D Model of that protein. If you run into a CSV,
            we'll parse that CSV, and provide grouping, graphing and sorting. All without needing to download or have run software locally.


            <br /><br />
            <strong>Supported Data Formats: </strong>
            <br />
            <strong>Structured:</strong> CSV, TSV, JSON, Parquet
            <br />
            <strong></strong>Scientific: Jupyter, FASTA, BAM, NGS
            <br />
            <strong></strong>Image: TIFF, PDF, PNG, HDP5
            <br />
            <strong></strong>Productivity: Markdown, PDF, Excel, PowerPoint


              {/* Decision quality suffers, experiments are needlessly
            repeated, and teams waste months doing "data archaeology" to reconstruct past
            results. */}
          </>
        }
      />
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
      {/* <Section>
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
      </Section> */}
      {/* <Lede
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
      /> */}

      {/* Rob: Another grid arrangement task. Can the Lede be left and the Video be right?*/}
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
            <Video />
          </>
        }
      />

      {/* <M.Box alignItems="center" display="flex" flexDirection="column" padding={4}>
        <img src={imageArch} width="80%" />
      </M.Box> */}
      {/* <LogosCarousel logos={logos} title="Your peers trust Quilt for data management" /> */}

      <M.Box pt={2} />
      <Section>
        <M.Box display="flex" flexDirection="row" alignItems="center" pb={2} pt={15}>
          <M.Button variant="contained" color="primary" onClick={talk}>
            Schedule a demo
          </M.Button>
          <br />
      </M.Box>
      <M.Box display="flex" flexDirection="row" alignItems="center" pb={15} pt={2}>
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

export default function ReInventWrapper() {
  // Layout injects TalkToUs provider into the component tree
  // (required for ReInvent component)
  return (
    <Layout>
      <ReInvent />
    </Layout>
  )
}
