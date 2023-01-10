import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import logoCelsius from './logo-celsius.png'
import logoResilience from './logo-resilience.png'
import logoTessera from './logo-tessera.png'

const useCaseStudyStyles = M.makeStyles((t) => ({
  logo: {
    display: 'block',
    margin: '0 auto 22px',
    height: '64px',
    background: '50% no-repeat',
  },
  title: {
    color: t.palette.text.primary,
    fontSize: '20px',
    lineHeight: '28px',
    textAlign: 'center',
    margin: '0 10px 22px',
  },
  content: {
    color: t.palette.text.secondary,
    fontSize: '16px',
    lineHeight: '32px',
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
  className?: string
  content: string
  link: string
  logo: string
  title: string
}

function CaseStudy({ className, title, content, link, logo }: CaseStudyProps) {
  const classes = useCaseStudyStyles()
  const backgroundImageStyle = React.useMemo(
    () => ({
      backgroundImage: `url(${logo})`,
    }),
    [logo],
  )
  return (
    <div className={className}>
      <div className={classes.logo} style={backgroundImageStyle} />
      <M.Typography className={classes.title}>{title}</M.Typography>
      <M.Typography className={classes.content}>{content}</M.Typography>
      <p className={classes.readMore}>
        <a className={classes.link} href={link} target="_blank">
          Read more
        </a>
      </p>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
    padding: t.spacing(4, 6, 10),
  },
  columns: {
    display: 'grid',
    gridGap: '98px',
    gridTemplateColumns: '1fr 1fr 1fr',
  },
  title: {
    color: t.palette.text.primary,
    fontSize: '48px',
    lineHeight: '56px',
    marginBottom: '56px',
    textAlign: 'center',
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
            title="Improving Data Management with Quilt and NextFlow"
            content="Tessera Therapeutics is a pioneer in gene writing, using technology to insert messages into genomes to treat diseases. The company needed to manage and share more than 12 terabytes of scientific data across large teams of wet scientists and computational biologists. To address this, Tessera implemented Quilt Data and Nextflow to ensure that data was findable, accessible, interoperable, and reusable (FAIR) and to accelerate its gene-writing discoveries to market"
            logo={logoTessera}
            link="https://quiltdata.com"
          />
          <CaseStudy
            title="Accelerating Data Access and Collaboration with DataSync"
            content="National Resilience, Inc. (Resilience) is a manufacturing and technology company that uses Quilt Data to manage and share data from its research sites, enabling scientists to access data faster and collaborate more effectively. By using Quilt's deep indexing and free-text search capabilities, Resilience can easily browse and access data from over 100 instruments and 10 million files in Amazon S3. The Quilt API also helps Resilience track data and intellectual property as it moves from research and analysis to downstream, GXP, and manufacturing processes."
            logo={logoResilience}
            link="https://quiltdata.com"
          />
          <CaseStudy
            title="Managing and Accessing Data for Single Cell Genomics Research"
            content="Celsius Therapeutics is using Quilt Data to manage and access data for single cell genomics research in the areas of cancer and autoimmune disease. Quilt helps Celsius maintain full versioning of its data sets and track data down to specific attributes and characteristics. The company has used Quilt to scale from a startup to production, uniformly access all its data types, and build apps to meet the specific needs of scientists."
            logo={logoCelsius}
            link="https://quiltdata.com"
          />
        </div>
      </M.Container>
    </div>
  )
}
