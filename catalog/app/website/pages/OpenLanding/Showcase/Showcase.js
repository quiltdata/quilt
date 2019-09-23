import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'
import Overlay1Full from 'website/components/Backgrounds/Overlay1Full'
import Overlay2 from 'website/components/Backgrounds/Overlay2'

import Carousel from './Carousel'

import slide1 from './chloropleth.png'
import slide2 from './overview.png'
import slide3 from './genomes-images.png'
import slide4 from './terrain-tiles.png'
import slide5 from './versions.png'
import slide6 from './packages.png'

const slides = [
  {
    src: slide1,
    caption: 'Choose from more than 25 visualizations',
  },
  {
    src: slide2,
    caption: 'Summarize massive data collections',
  },
  {
    src: slide5,
    caption: 'Version every file',
  },
  {
    src: slide6,
    caption: 'Create versioned data sets from buckets or folders',
  },
  {
    src: slide3,
    caption: 'Generate summary images',
  },
  {
    src: slide4,
    caption: 'Browse image collections',
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
              Quilt is a versioned data portal for AWS. open.quiltdata.com offers access
              to the world&apos;s public data in S3, including Amazon&apos;s Registry of
              Open Data.
            </M.Typography>
          </M.Box>
          <M.Box mt={4}>
            <M.Link color="textPrimary" underline="none" href="#quilt-is-different">
              Learn more about open data
              <M.Icon color="primary" style={{ verticalAlign: 'middle' }}>
                chevron_right
              </M.Icon>
            </M.Link>
          </M.Box>
          <M.Box mt={2}>
            <M.Link color="textPrimary" underline="none" href="#quilt-is-different">
              Explore Quilt for private data
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
