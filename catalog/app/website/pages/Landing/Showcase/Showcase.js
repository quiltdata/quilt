import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'
import ChevronLink from 'website/components/ChevronLink'
import Overlay1Full from 'website/components/Backgrounds/Overlay1Full'
import Overlay2 from 'website/components/Backgrounds/Overlay2'
import Screenshots from 'website/components/Screenshots'

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(9),
    position: 'relative',
  },
  container: {
    display: 'grid',
    paddingBottom: t.spacing(5),
    position: 'relative',
    [t.breakpoints.up('md')]: {
      gridColumnGap: t.spacing(10),
      gridTemplateColumns: '1fr 1fr',
      gridTemplateAreas: '"text carousel"',
    },
    [t.breakpoints.up('lg')]: {
      gridTemplateColumns: '1fr 640px',
    },
    [t.breakpoints.down('sm')]: {
      gridRowGap: t.spacing(8),
      gridTemplateRows: 'auto auto',
      gridTemplateAreas: `
        "text"
        "carousel"
      `,
    },
  },
  text: {
    gridArea: 'text',
  },
  textInner: {
    [t.breakpoints.up('md')]: {
      maxWidth: 400,
    },
  },
  carousel: {
    gridArea: 'carousel',
    [t.breakpoints.up('md')]: {
      paddingTop: t.spacing(6),
    },
  },
}))

export default function Showcase() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Overlay2 />
      <Overlay1Full top={-80} />
      <M.Container maxWidth="lg" className={classes.container}>
        <div className={classes.text}>
          <div className={classes.textInner}>
            <Bar color="primary" />
            <M.Box mt={5}>
              <M.Typography variant="h1" color="textPrimary">
                A versioned data portal for AWS
              </M.Typography>
            </M.Box>
            <M.Box mt={4}>
              <M.Typography variant="body1" color="textSecondary">
                Share, understand, discover, and model data at scale.
              </M.Typography>
            </M.Box>
            <M.Box mt={2}>
              <M.Typography variant="body1" color="textSecondary">
                Quilt is a web catalog and Python client powered by AWS services in your
                private cloud.
              </M.Typography>
            </M.Box>
            <M.Box mt={5}>
              <M.Button
                variant="contained"
                color="primary"
                href="https://www.meetingbird.com/m/S19vxyVOH"
              >
                Book demo
              </M.Button>
              <M.Box display="inline-block" ml={2} />
              <M.Button variant="contained" color="secondary" href="/#pricing">
                Try now
              </M.Button>
            </M.Box>
            <M.Box mt={5}>
              <ChevronLink href="#get-notified">Stay informed about Quilt</ChevronLink>
            </M.Box>
          </div>
        </div>
        <Screenshots className={classes.carousel} />
      </M.Container>
    </div>
  )
}
