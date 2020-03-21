import * as React from 'react'
import * as M from '@material-ui/core'

import logoAllen from './logo-allencell.png'
import logoPulse from './logo-pulse.png'

const useStyles = M.makeStyles((t) => ({
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
    gridArea: 'logo',
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
          <article className={classes.study}>
            <div
              className={classes.studyLogo}
              style={{ backgroundImage: `url(${logoAllen})` }}
            />
            <h1 className={classes.studyHeading}>
              Distributing terabytes of versioned images to researchers
            </h1>
            <p className={classes.studyBody}>
              Dedicated to understanding and predicting the behavior of cells, the Allen
              Institute for Cell Science believes in scientific transparency,
              accessibility, and reproducibility. Learn how the Allen Institute partners
              with Quilt to distribute terabytes of cell images worldwide.
            </p>
            <M.Link
              className={classes.studyLink}
              href="https://aws.amazon.com/partners/success/allen-cell-quilt-data/"
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
              style={{ backgroundImage: `url(${logoPulse})` }}
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
