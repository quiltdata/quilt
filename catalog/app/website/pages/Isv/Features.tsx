import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'

import quiltBox from './quiltBox.png'
import quiltBox2x from './quiltBox@2x.png'

const useFeatureStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.primary,
    background: `50% 0 / 78px 78px url(${img2x(quiltBox, quiltBox2x)}) no-repeat`,
    padding: '100px 22px',
  },
  title: {
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
  className?: string
  title: string
  content: string
}

function Feature({ className, title, content }: FeatureProps) {
  const classes = useFeatureStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Typography className={classes.title}>{title}</M.Typography>
      <M.Typography className={classes.content}>{content}</M.Typography>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    columnGap: '46px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '55px 0',
  },
}))

interface FeaturesProps {
  className?: string
}

export default function Features({ className }: FeaturesProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <Feature
        title="Dataset Version Control"
        content="Quilt Data provides dataset immutability by allowing users to create and share datasets that are sealed and cryptographically verifiable, ensuring that the data cannot be altered after it has been shared. This helps to maintain the integrity and reliability of the data and ensures that users can trust the data they are working with."
      />
      <Feature
        title="Data Commons"
        content="Quilt Data provides data cataloguing by allowing users to create and share data packages that include the full data context (metadata, charts, documentation, lineage) and are findable via the Quilt web catalog. This helps users to easily discover and access datasets, as well as understand the context and lineage of the data. The Quilt web catalog also allows users to search for datasets using keywords, making it easy to find the data they need."
      />
      <Feature
        title="Visualizations"
        content="Quilt Data provides visualization capabilities that allow users to view and analyze their data in a variety of formats. These visualizations can be customized and shared with others, helping users to understand and communicate the insights and trends contained within the data. Quilt's visualization capabilities include a range of charts, plots, and graphs that can be used to explore and interpret data. Users can also add custom analytics and visualizations to their data packages, enabling them to gain a deeper understanding of their data and share their findings with others."
      />
    </div>
  )
}
