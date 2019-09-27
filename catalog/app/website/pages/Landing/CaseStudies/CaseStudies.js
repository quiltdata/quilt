import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
    paddingBottom: t.spacing(12),
    paddingTop: t.spacing(10),
    position: 'relative',
  },
  studies: {
    display: 'flex',
    justifyContent: 'space-around',
    paddingTop: t.spacing(7),
  },
  study: {
    maxWidth: 500,
  },
}))

export default function CaseStudies() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <M.Container maxWidth="lg" className={classes.container}>
        <M.Typography variant="h1" color="textPrimary" align="center">
          Case studies
        </M.Typography>
        <div className={classes.studies}>
          <div className={classes.study}>
            <M.Typography variant="h4" color="textPrimary">
              Distributing terabytes of versioned images to researchers
            </M.Typography>
            <M.Box mt={2} mb={2}>
              <M.Typography variant="body2" color="textSecondary">
                Dedicated to understanding and predicting the behavior of cells, the Allen
                Institute for Cell Science believes in scientific transparency,
                accessibility, and reproducibility. Learn how the Allen Institute partners
                with Quilt to distribute terabytes of cell images worldwide.
              </M.Typography>
            </M.Box>
            <M.Link
              href="https://aws.amazon.com/partners/success/allen-cell-quilt-data/"
              color="secondary"
              underline="always"
              variant="body1"
            >
              <b>Read more</b>
            </M.Link>
          </div>
          <div className={classes.study}>
            <M.Typography variant="h4" color="textPrimary">
              The future of data collaboration in S3
            </M.Typography>
            <M.Box mt={2} mb={2}>
              <M.Typography variant="body2" color="textSecondary">
                We surveyed 100 IT executives on the importance of data versioning,
                machine learning hubs, data quality, and the role of S3.
              </M.Typography>
            </M.Box>
            <M.Link
              href="https://quilt-web-public.s3.amazonaws.com/docs/The+Future+of+Data+Collaboration+in+S3.pdf"
              color="secondary"
              underline="always"
              variant="body1"
            >
              <b>Read more</b>
            </M.Link>
          </div>
        </div>
      </M.Container>
    </div>
  )
}
