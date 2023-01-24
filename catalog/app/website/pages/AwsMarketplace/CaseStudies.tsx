import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import logoCelsius from './logo-celsius.png'
import logoResilience from './logo-resilience.svg'
import logoTessera from './logo-tessera.png'

const useCaseStudyStyles = M.makeStyles((t) => ({
  logo: {
    display: 'block',
    margin: '0 auto 22px',
    height: '64px',
  },
  heading: {
    color: t.palette.text.primary,
    fontSize: '20px',
    lineHeight: '28px',
    textAlign: 'center',
    margin: '0 10px 22px',
  },
  content: {
    color: t.palette.text.secondary,
    fontSize: '14px',
    lineHeight: '28px',
  },
  readMore: {
    marginTop: t.spacing(1),
    fontSize: '16px',
    lineHeight: '32px',
  },
  link: {
    color: t.palette.secondary.main,
    '&:hover': {
      color: t.palette.secondary.light,
    },
  },
}))

interface CaseStudyProps {
  children: React.ReactNode
  className?: string
  heading: React.ReactNode
  link: string
  logoClassName: string
}

function CaseStudy({
  children,
  className,
  heading,
  link,
  logoClassName,
}: CaseStudyProps) {
  const classes = useCaseStudyStyles()
  return (
    <div className={className}>
      <div className={cx(classes.logo, logoClassName)} />
      <M.Typography className={classes.heading}>{heading}</M.Typography>
      <M.Typography className={classes.content}>{children}</M.Typography>
      <p className={classes.readMore}>
        <a className={classes.link} href={link} target="_blank">
          Download
        </a>
      </p>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
    padding: t.spacing(10, 6, 12),
  },
  item: {
    [t.breakpoints.down('sm')]: {
      '& + &': {
        marginTop: t.spacing(4),
      },
    },
  },
  columns: {
    [t.breakpoints.up('sm')]: {
      display: 'grid',
      gridGap: '98px',
      gridTemplateColumns: '1fr 1fr 1fr',
    },
  },
  title: {
    color: t.palette.text.primary,
    fontSize: '48px',
    lineHeight: '56px',
    marginBottom: '56px',
    textAlign: 'center',
  },
  logoCelsius: {
    background: `50% / auto 32px url(${logoCelsius})  no-repeat`,
  },
  logoTessera: {
    background: `50% url(${logoTessera})  no-repeat`,
  },
  logoResilience: {
    background: `50% / auto 36px url("${logoResilience}")  no-repeat`,
  },
}))

interface CaseStudiesProps {
  className?: string
}

export default function CaseStudies({ className }: CaseStudiesProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Typography className={classes.title} variant="h1">
        Case Studies
      </M.Typography>
      <M.Container maxWidth="xl">
        <div className={classes.columns}>
          <CaseStudy
            className={classes.item}
            heading="Improving Data Management with Quilt and NextFlow"
            link="https://quilt-web-public.s3.amazonaws.com/docs/Tessera.pdf"
            logoClassName={classes.logoTessera}
          >
            Tessera Therapeutics is a pioneer in gene writing, using technology to insert
            messages into genomes to treat diseases. The company needed to manage and
            share more than 12 terabytes of scientific data across large teams of wet
            scientists and computational biologists. To address this, Tessera implemented
            Quilt Data and Nextflow to ensure that data was findable, accessible,
            interoperable, and reusable (FAIR) and to accelerate its gene-writing
            discoveries to market"
          </CaseStudy>
          <CaseStudy
            className={classes.item}
            heading="Accelerating Data Access and Collaboration with DataSync"
            link="https://quilt-web-public.s3.amazonaws.com/docs/Resilience.pdf"
            logoClassName={classes.logoResilience}
          >
            National Resilience, Inc. (Resilience) is a manufacturing and technology
            company that uses Quilt Data to manage and share data from its research sites,
            enabling scientists to access data faster and collaborate more effectively. By
            using Quilt's deep indexing and free-text search capabilities, Resilience can
            easily browse and access data from over 100 instruments and 10 million files
            in Amazon S3. The Quilt API also helps Resilience track data and intellectual
            property as it moves from research and analysis to downstream, GXP, and
            manufacturing processes.
          </CaseStudy>
          <CaseStudy
            className={classes.item}
            heading="Managing and Accessing Data for Single Cell Genomics Research"
            link="https://quilt-web-public.s3.amazonaws.com/docs/Celsius.pdf"
            logoClassName={classes.logoCelsius}
          >
            Celsius Therapeutics is using Quilt Data to manage and access data for single
            cell genomics research in the areas of cancer and autoimmune disease. Quilt
            helps Celsius maintain full versioning of its data sets and track data down to
            specific attributes and characteristics. The company has used Quilt to scale
            from a startup to production, uniformly access all its data types, and build
            apps to meet the specific needs of scientists.
          </CaseStudy>
        </div>
      </M.Container>
    </div>
  )
}
