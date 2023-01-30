import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import dataCommons from './dataCommons.svg'
import dataVersionControl from './dataVersionControl.svg'
import visualizations from './visualizations.svg'

const useFeatureStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.primary,
    background: `50% 0 / 78px 78px no-repeat`,
    padding: '100px 22px',
  },
  heading: {
    textAlign: 'center',
    fontSize: '23px',
    lineHeight: '32px',
    marginBottom: '10px',
  },
  content: {
    fontSize: '13px',
    lineHeight: '32px',
    [t.breakpoints.down('sm')]: {
      fontSize: '14px',
    },
  },
}))

interface FeatureProps {
  children: React.ReactNode
  className?: string
  heading: string
  logo: string
}

function Feature({ children, className, heading, logo }: FeatureProps) {
  const classes = useFeatureStyles()
  const imgStyles = React.useMemo(() => ({ backgroundImage: `url("${logo}")` }), [logo])
  return (
    <div className={cx(classes.root, className)} style={imgStyles}>
      <M.Typography className={classes.heading}>{heading}</M.Typography>
      <M.Typography className={classes.content}>{children}</M.Typography>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    columnGap: '46px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '55px 0',
    [t.breakpoints.down('sm')]: {
      display: 'block',
    },
  },
}))

interface FeaturesProps {
  className?: string
}

export default function Features({ className }: FeaturesProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <Feature heading="Data Versioning" logo={dataVersionControl}>
        Take control of your data with Quilt Packages. Manage every version of your datasets with ease, 
        using our robust data version control system. Quilt empowers you to create and share packages that 
        securely store your data, complete with cryptographic fingerprints for verifiable revision history. 
        Ensure data integrity and reliability, and trace the lineage of your data with confidence.
      </Feature>
      <Feature heading="Collaborate" logo={dataCommons}>
        Unleash the full potential of your data with Quilt Data's data catalog. Create and share data packages 
        complete with metadata, charts, documentation, and lineage to give others the complete context they need. 
        Effortlessly discover and access the datasets you need with our keyword-powered search feature, making it 
        simple to find relevant and actionable data. 
      </Feature>
      <Feature heading="Visualize" logo={visualizations}>
        Take control of your data insights with Quilt's comprehensive and customizable platform for analysis 
        and visualization. Utilize Quilt's powerful capabilities to view and analyze your data in a variety of 
        formats, including charts, plots, and graphs. Explore and interpret your data with ease, and add custom 
        interactives and visualizations to gain a deeper understanding. With Quilt's built-in native visualizations 
        for Genomes using Interactive Genome Viewer (IGV) and protein structures (PDB Files), scientists can 
        see exactly which data they're exploring, directly within their browser.
      </Feature>
    </div>
  )
}
