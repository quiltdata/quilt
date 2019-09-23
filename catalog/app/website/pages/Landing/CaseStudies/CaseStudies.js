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
              The future of data collaboration in S3
            </M.Typography>
            <M.Box mt={2} mb={2}>
              <M.Typography variant="body2" color="textSecondary">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
                tempor incididunt ut labore et dolore magna aliqua. Quis ipsum suspendisse
                ultrices gravida. Risus commodo viverra maecenas accumsan lacus vel.
              </M.Typography>
            </M.Box>
            <M.Link href="TBD" color="secondary" underline="always" variant="body1">
              <b>Read more</b>
            </M.Link>
          </div>
        </div>
      </M.Container>
    </div>
  )
}
