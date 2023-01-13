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

const useStyles = M.makeStyles({
  root: {
    columnGap: '46px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '55px 0',
  },
})

interface FeaturesProps {
  className?: string
}

export default function Features({ className }: FeaturesProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <Feature heading="Verify" logo={dataVersionControl}>
        Create and share sealed, immutable datasets with cryptographic fingerprints
        that guarantee data are pristine and unchanged. Maintain data integrity, reliability,
        and lineage so that every dataset is trustworthy.
      </Feature>
      <Feature heading="Collaborate" logo={dataCommons}>
        Quilt Data provides data cataloguing by allowing users to create and share data
        packages that include the full data context (metadata, charts, documentation,
        lineage) and are findable via the Quilt web catalog. This helps users to easily
        discover and access datasets, as well as understand the context and lineage of the
        data. The Quilt web catalog also allows users to search for datasets using
        keywords, making it easy to find the data they need.
      </Feature>
      <Feature heading="Visualize" logo={visualizations}>
        Quilt Data provides visualization capabilities that allow users to view and
        analyze their data in a variety of formats. These visualizations can be customized
        and shared with others, helping users to understand and communicate the insights
        and trends contained within the data. Quilt's visualization capabilities include a
        range of charts, plots, and graphs that can be used to explore and interpret data.
        Users can also add custom analytics and visualizations to their data packages,
        enabling them to gain a deeper understanding of their data and share
        their findings with others.
      </Feature>
    </div>
  )
}
