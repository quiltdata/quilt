import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'
import Overlay1Full from 'website/components/Backgrounds/Overlay1Full'
import Overlay2 from 'website/components/Backgrounds/Overlay2'

import Carousel from './Carousel'

import slide1 from './slide1.png'
import slide2 from './slide2.png'
import slide3 from './slide3.png'
import slide4 from './slide4.png'

const slides = [
  {
    src: slide1,
    caption: 'Choose from one of 25 visualizations',
  },
  {
    src: slide2,
    caption: 'Lorem ipsum dolor sit amet',
  },
  {
    src: slide3,
    caption: 'Choose from one of 25 visualizations',
  },
  {
    src: slide4,
    caption: 'Choose from one of 25 visualizations',
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {
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
      gridRowGap: t.spacing(4),
      gridTemplateRows: 'auto auto',
      gridTemplateAreas: `
        "text"
        "carousel"
      `,
    },
  },
  text: {
    gridArea: 'text',
    [t.breakpoints.up('lg')]: {
      paddingTop: t.spacing(6),
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
          <Bar color="primary" />
          <M.Box mt={5}>
            <M.Typography variant="h1" color="textPrimary">
              Publish and discover unlimited data
            </M.Typography>
          </M.Box>
          <M.Box mt={4}>
            <M.Typography variant="body1" color="textSecondary">
              Quilt is a versioned data portal for blob storage. Quilt is a web catalog, a
              Python client, and backend services that run in a private cloud. You can
              search, visualize, version, and share data of any size in any format with
              Quilt.
            </M.Typography>
          </M.Box>
          <M.Box mt={4}>
            <M.Link color="textPrimary" underline="none" href="#quilt-is-different">
              Learn more
              <M.Icon color="primary" style={{ verticalAlign: 'middle' }}>
                chevron_right
              </M.Icon>
            </M.Link>
          </M.Box>
        </div>
        <Carousel className={classes.carousel} slides={slides} />
      </M.Container>
    </div>
  )
}
