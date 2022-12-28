import * as React from 'react'
import * as M from '@material-ui/core'

import { useTalkToUs } from 'components/TalkToUs'
import MetaTitle from 'utils/MetaTitle'

import AwsPartner from 'website/components/AwsPartner'
import CaseStudies from 'website/pages/Landing/CaseStudies'
// import useStyles from 'website/pages/Landing/CaseStudies'
import Dots from 'website/components/Backgrounds/Dots'
import ChevronLink from 'website/components/ChevronLink'
import LogosCarousel from 'website/pages/Landing/LogosCarousel'
import Layout from 'website/components/Layout'
import Lede from 'website/components/Lede'

import logoAllencell from 'website/pages/Landing/Logos/logo-allencell.png'
import logoCelsius from 'website/pages/Landing/Logos/logo-celsius.png'
import logoNeumora from 'website/pages/Landing/Logos/logo-neumora.png'
import logoObsidian from 'website/pages/Landing/Logos/logo-obsidian.png'
import logoStemson from 'website/pages/Landing/Logos/logo-stemson.png'
import logoVir from 'website/pages/Landing/Logos/logo-vir.png'
import logoTessera from 'website/pages/Landing/Logos/logo-tessera.png'
import logoCellarity from 'website/pages/Landing/Logos/logo-cellarity.png'
import logoResilience from 'website/pages/Landing/Logos/logo-resilience.png'
//import { useStyles } from './Landing/CaseStudies/CaseStudies'

const SALES_ADDRESS = 'mailto:sales@quiltdata.io'
const DECK_URL =
  'https://s3.amazonaws.com/quilt-sales-public/Quilt-Data_Mesh.pdf'

  const useStyles = M.makeStyles((t) => ({
    container: {
      alignItems: 'center',
      display: 'flex',
      marginBottom: t.spacing(-2),
      marginLeft: t.spacing(3),
      marginTop: t.spacing(-2),
    },
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

const logos = [
  {
    src: logoTessera,
    title: 'Tessera Therapeutics',
  },
  {
    src: logoCellarity,
    title: 'Cellarity',
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

function ReInventCaseStudies() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <M.Container maxWidth="lg" className={classes.container}>
        <M.Typography variant="h1" color="textPrimary" align="center">
          Case studies
        </M.Typography>
        <div className={classes.studies}>
          <article className={classes.study}>
            <div
              className={classes.studyLogo}
              style={{ backgroundImage: `url(${logoResilience})` }}
            />
            <h1 className={classes.studyHeading}>
              Cataloging tens of Terabytes from hundreds of instruments.
            </h1>
            <p className={classes.studyBody}>
              Dedicated to creating the AWS of Biotechnology, Resilience is in the 
              business of managing huge data. Learn how Resilience collects data from 
              dozens of sites and makes it available to their global team nearly instantly
              with Quilt.
            </p>
            <M.Link
              className={classes.studyLink}
              href=""
              color="secondary"
              underline="always"
              variant="body1"
            >
              <b>Read more</b>
            </M.Link>
          </article>
          <article className={classes.study}>
            <div
              className={classes.studyLogo}
              style={{ backgroundImage: `url(${logoTessera})` }}
            />
            <h1 className={classes.studyHeading}>
              The future of data collaboration in S3
            </h1>
            <p className={classes.studyBody}>
              We surveyed 100 IT executives on the importance of data versioning, machine
              learning hubs, data quality, and the role of S3.
            </p>
            <M.Link
              className={classes.studyLink}
              href="https://quilt-web-public.s3.amazonaws.com/docs/The+Future+of+Data+Collaboration+in+S3.pdf"
              color="secondary"
              underline="always"
              variant="body1"
            >
              <b>Read more</b>
            </M.Link>
          </article>
        </div>
      </M.Container>
    </div>
  )
}

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
            FAIR data are a mirage
            <br />
            until people are enrolled
          </>
        }
        detail={
          <>
            Successful discoveries in the wet and dry sciences are not about how many
            experiments you run or how well you design them, but how effectively you
            retain the knowledge from each experiment—in order to plan future experiments
            and author trusted filings. 
            <M.Box pt={2} />
            Although <strong>FLAIR</strong> (findable, linkable, accessible,
            interoperable, reusable) is a widely touted destination for data, the <strong>FAIR </strong> 
            framework fails to provide a means to achieve FAIRness. This leaves science
            teams stuck facing real-world data that are often <strong>FOUL</strong> (fragmented, opaque,
            unreliable, and lost), frustrated.

            <M.Box display="flex" flexDirection="column" pt={2} maxWidth="30rem">
            <M.Button variant="contained" color="primary" onClick={talk}>
              Book a demo
            </M.Button>
            <M.Box pt={4} />
            <ChevronLink href={SALES_ADDRESS}>Get in touch with us</ChevronLink>
            <ChevronLink href={DECK_URL} target="_blank">
              Deck: Quilt the Data Mesh for Life Sciences (PDF)
            </ChevronLink>
          </M.Box>
          </>
        }
      />
      <M.Box zIndex={1}>
        <LogosCarousel logos={logos} title="Life Sciences Organizations Run on Quilt" />
      </M.Box>

      <M.Box zIndex={1}>
        <CaseStudies />
      </M.Box>

      <M.Box pt={2} />

      {/* <Lede
        heading={
          <>
            Ensure reusability
            <br />
            with human-readable data containers
          </>
        }
        detail={
          <>
            Quilt Packages are open source, human-readable collections of data, metadata,
            charts, documentation, and lineage. They track the{' '}
            <strong>data chain of custody</strong> from instrument, to pipeline, to
            scientist, to filing—so that cross-functional teams of wet and dry scientists
            can bring impactful discoveries to market with confidence. Packages are the
            building blocks for the Quilt Data Mesh for life sciences, which turns
            ordinary S3 buckets into trusted, accessible repositories of knowledge. The
            Quilt data mesh embraces data of any structure or size, and provides an
            end-to-end data lifecycle for refining datasets from raw, to refined, to
            curated.
          </>
        }
        
      /> */}
      {/* <Lede
        variant="center"
        heading={
          <>
            Quilt: The Full-Stack Solution
            <br />
            for retaining the knowledge
            <br />
            from every experiment
          </>
        }
        detail={
          <>
            <ol style={{ textAlign: 'left' }}>
              <li>
                <b className="feature">Visual Web Catalog.</b> Quilt's self-service web
                catalog makes it easy for non-developers to find, curate, visualize, and
                explore the data they care about <em>without asking IT for anything</em>.
              </li>
              <li>
                <b className="feature">Augment any ELN with URLs for datasets.</b> ELNs
                are good for metadata and protocols, but fail to capture the "full data
                context" in the form of large instrument files, analyses, and pipeline
                outputs. Each dataset in the Quilt data mesh includes an{' '}
                <strong>immutable revision history</strong>, safeguarding data against
                deletion and unwanted edits, and verifying the integrity of your datasets
                and conclusions with a cryptographic fingerprint and the full data lineage
                of every change to the dataset. Link unlimited and sealed data to ELNs
                with a simple URL.
              </li>
              <li>
                <b className="feature">Accessible to developers and non-developers.</b>{' '}
                Quilt packages are human-readable collections with charts and
                documentation that can be accessed via a Python API or private web
                catalog.
              </li>
              <li>
                <b className="feature">Built for the private cloud.</b> Quilt's data plane
                and control plane run in your Amazon accounts, ensuring that no third
                party ever has access to your data, and guaranteeing that your data can
                never be held hostage by any vendor.
              </li>
              <li>
                <b className="feature">No schema? No problem.</b> Quilt packages can
                include data of any size or structure. FASTQs, Excel files, PowerPoints,
                JSON—bring them all together in a Quilt package and gradually refine and
                discover the structure of your data—instead of planning it up front—with
                Quilt's <strong>emergent data lifecycle</strong> that gives you guide
                rails to transition data from raw, to refined, to curated.
              </li>
              <li>
                <b className="feature">
                  Powered by Amazon S3, EventBridge, OpenSearch, Athena.
                </b>{' '}
                Quilt is a cloud-native platform that interoperates with the entire Amazon
                ecosystem so that you can choose from the broadest variety of compute
                services and integrate all of your cloud services into a single data mesh.
              </li>
              <li>
                <b className="feature">Standardized Metadata Workflows</b> allow you to
                define, edit, require, and reliably search organization-specific or
                industry-standard taxonomies (represented as JSON Schemas).
              </li>
            </ol>
          </>
        }
      /> */}
      {/* <Lede
        variant="center"
        heading={<>Supported Data Formats</>}
        detail={
          <>
            The following are a few of the file types the Quilt Catalog for Amazon S3
            supports:
            <ul style={{ textAlign: 'left' }}>
              <li>
                <strong>Structured:</strong> CSV, TSV, JSON, Parquet
              </li>
              <li>
                <strong>Scientific:</strong> FASTA, FASTQ, BAM, NGS, VCF, FCS, and many
                more
              </li>
              <li>
                <strong>Image:</strong> TIFF, PDF, PNG, JPG, HDP5, CZI, OME-TIFF
              </li>
              <li>
                <strong>Productivity:</strong> Markdown, PDF, Excel, PowerPoint
              </li>
              <li>
                <strong>Interactive:</strong> Jupyter, Altair, eCharts, Voila, iPyWidgets,
                IGV
              </li>
            </ul>
          </>
        }
      /> */}
      <Lede
        heading={<>Quilt and AWS</>}
        detail={
          <>
            <AwsPartner className={classes.awsPartner} style={{ marginRight: '32px' }} />
            Quilt Data is an Amazon Advanced Technology Partner. Quilt brings seamless
            collaboration to Amazon S3 by connecting people, pipelines, and machines using
            visual, verifiable, versioned data packages.
            <M.Box pt={2} /> Amazon Web Services provides secure, cost-effective, and
            scalable big data services that can help you build a Data Lake to collect,
            store, and analyze massive volumes of heterogeneous data.
          </>
        }
        maxWidth="55rem"
      />
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
