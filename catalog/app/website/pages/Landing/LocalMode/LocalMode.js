import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'
import ChevronLink from 'website/components/ChevronLink'
import Overlay1Full from 'website/components/Backgrounds/Overlay1Full'
import Overlay2 from 'website/components/Backgrounds/Overlay2'
import Screenshots from 'website/components/Screenshots'

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingBottom: t.spacing(10),
    paddingTop: t.spacing(9),
    position: 'relative',
  },
  container: {
    display: 'grid',
    position: 'relative',
    [t.breakpoints.up('lg')]: {
      gridColumnGap: t.spacing(10),
      gridTemplateColumns: '1fr 640px',
      gridTemplateAreas: '"text carousel"',
    },
    [t.breakpoints.down('md')]: {
      gridRowGap: t.spacing(15),
      gridTemplateRows: 'auto auto',
      gridTemplateAreas: `
        "text"
        "carousel"
      `,
    },
  },
  text: {
    gridArea: 'text',
    paddingTop: t.spacing(5),
  },
  textInner: {
    [t.breakpoints.up('lg')]: {
      maxWidth: 400,
    },
    [t.breakpoints.down('md')]: {
      display: 'flex',
      flexDirection: 'column',
    },
  },
  carousel: {
    gridArea: 'carousel',
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
                Quilt&nbsp;catalog: Local&nbsp;development&nbsp;mode
              </M.Typography>
            </M.Box>
            <M.Box mt={4}>
              <M.Typography variant="body1" color="textSecondary">
                This is a limited version of the Quilt catalog for development and
                temporary demos. Key features such as user authentication, analytics,
                preview, and more are not available in local dev mode.
              </M.Typography>
            </M.Box>
            <M.Box mt={4}>
              <ChevronLink href="https://docs.quiltdata.com/v/master/catalog/localmode">
                Read more about local mode
              </ChevronLink>
            </M.Box>
            <M.Box mt={2}>
              <M.Button variant="contained" color="primary" href="https://quiltdata.com">
                Learn more about Quilt
              </M.Button>
            </M.Box>
          </div>
        </div>
        <Screenshots className={classes.carousel} />
      </M.Container>
    </div>
  )
}
