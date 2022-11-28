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

import logoAllencell from 'website/pages/Landing/Logos/logo-allencell.png'
import logoCelsius from 'website/pages/Landing/Logos/logo-celsius.png'
import logoNeumora from 'website/pages/Landing/Logos/logo-neumora.png'
import logoObsidian from 'website/pages/Landing/Logos/logo-obsidian.png'
import logoStemson from 'website/pages/Landing/Logos/logo-stemson.png'
import logoVir from 'website/pages/Landing/Logos/logo-vir.png'
import logoTessera from 'website/pages/Landing/Logos/logo-tessera.png'
import logoCellarity from 'website/pages/Landing/Logos/logo-cellarity.png'

const SALES_ADDRESS = 'mailto:sales@quiltdata.io'
const DECK_URL = 'https://s3.amazonaws.com/quilt-sales-public/Quilt-Data_Mesh.pdf'

const logos = [
  // Rob: Needs to be turned white
  {
    src: logoTessera,
    title: 'Tessera Therapeutics',
  },
  // Rob: Needs to be turned white
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
        heading={<>Improve Return on Data</>}
        variant="left"
        detail={
          <>
            <Section>
              <M.Box display="flex" flexDirection="column" pt={6}>
                <M.Button variant="contained" color="primary" onClick={talk}>
                  Book a demo
                </M.Button>
              </M.Box>
              <M.Box pt={3} />
              <ChevronLink href={SALES_ADDRESS}>Email us a question</ChevronLink>
              <M.Box pt={3} />
              <ChevronLink href={DECK_URL}>
                Deck: Quilt the Data Mesh for Life Sciences (PDF)
              </ChevronLink>
            </Section>
          </>
        }
      />
      <Lede
        variant="flying"
        heading={<>FAIR data are a mirage until people are enrolled</>}
        detail={
          <>
            Successful discoveries in the wet and dry sciences are not about how many
            experiments you run or how well you design them, but how effectively you
            retain the knowledge from each experiment—in order to plan future experiments
            and author trusted filings. Although FLAIR (findable, linkable, accessible,
            interoperable, reusable) is a widely touted destination for data, the FAIR
            framework fails to provide a means to achieve FAIRness. This leaves science
            teams stuck facing real-world data that are often FOUL (fragmented, opaque,
            unreliable, and lost), frustrated.
          </>
        }
      />
      <Lede
        variant="flying"
        heading={<>Ensure reusability with human-readable data containers</>}
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
      />
      <Lede
        variant="flying"
        heading={
          <>
            Quilt: The Full-Stack Solution
            <br />
            for retaining the knowledge from every experiment
          </>
        }
        detail={
          <>
            <ol>
              <li>
                <b className="feature">Visual Web Catalog.</b> Quilt's self-service web
                catalog makes it easy for non-developers to find, curate, visualize, and
                explore the data they care about <em>without asking IT for anything</em>.
              </li>
              <li>
                <b className="feature">Augment any ELN with URLs for datasets.</b>ELNs are
                good for metadata and protocols, but fail to capture the "full data
                context" in the form of large instrument files, analyses, and pipeline
                outputs. Each dataset in the Quilt data mesh includes an{' '}
                <strong>immutable revision history</strong>, safeguarding data against
                deletion and unwanted edits, and verifying the integrity of your datasets
                and conclusions with a cryptographic fingerprint and the full data lineage
                of every change to the dataset. Link unlimited and sealed data to ELNs
                with a simple URL.
              </li>
              <li>
                <b className="feature">Accessible to developers and non-developers.</b>
                Quilt packages are human-readable collections with charts and
                documentation that can be accessed via a Python API or private web
                catalog.
              </li>
              <li>
                <b className="feature">Built for the private cloud.</b>Quilt's data plane
                and control plane run in your Amazon accounts, ensuring that no third
                party ever has access to your data, and guaranteeing that your data can
                never be held hostage by any vendor.
              </li>
              <li>
                <b className="feature">No schema? No problem.</b>Quilt packages can
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
      />

      {/* Rob: For this one, I'd like to be able to drop an image to the left and the right. */}
      <Lede
        heading={<>Supported Data Formats</>}
        variant="flying"
        detail={
          <>
            The following are a few of the file types the Quilt Catalog for Amazon S3
            supports:
            <ul>
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
      />

      {/* Add Logo Carosel here */}
      <M.Box zIndex={1}>
        <LogosCarousel logos={logos} title="Life Sciences Organizations Run on Quilt" />
      </M.Box>

      <M.Box zIndex={1}>
        <CaseStudies />{' '}
      </M.Box>

      <Lede
        heading={<>About Quilt Data and AWS</>}
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
