import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'
import AwsPartner from 'website/components/AwsPartner'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(8, 0, 6),
  },
  awsPartner: {
    maxWidth: '100%',
    [t.breakpoints.up('sm')]: {
      marginRight: t.spacing(4),
    },
    [t.breakpoints.down('sm')]: {
      marginBottom: t.spacing(4),
    },
  },
  bar: {
    margin: 'auto',
  },
  title: {
    textAlign: 'center',
    fontSize: '48px',
    lineHeight: '56px',
    margin: t.spacing(4, 0),
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    margin: 'auto',
    maxWidth: '860px',
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
}))

interface AwsProps {
  className?: string
}

export default function Aws({ className }: AwsProps) {
  const classes = useStyles()
  return (
    <section className={cx(classes.root, className)}>
      <Bar className={classes.bar} color="primary" />
      <M.Typography variant="h1" color="textPrimary" className={classes.title}>
        Quilt is an Advanced AWS Technology Partner
      </M.Typography>
      <div className={classes.content}>
        <AwsPartner className={classes.awsPartner} />
        <M.Typography variant="body1" color="textSecondary">
          Quilt Data is an AWS Advanced Technology Partner. Quilt brings seamless
          collaboration to Amazon S3 by connecting people, pipelines, and machines using
          visual, verifiable, versioned data packages. Amazon Web Services provides
          secure, cost-effective, and scalable big data services that can help you build a
          Data Lake to collect, store, and analyze massive volumes of heterogeneous data.
        </M.Typography>
      </div>
    </section>
  )
}
