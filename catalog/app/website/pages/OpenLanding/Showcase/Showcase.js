import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'

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
    caption: 'Choose from one of 25 visualizations',
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
    display: 'grid',
    [t.breakpoints.up('sm')]: {
      gridColumnGap: t.spacing(10),
      gridTemplateColumns: '1fr 640px',
      gridTemplateAreas: '"text carousel"',
    },
    [t.breakpoints.down('xs')]: {
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
    paddingBottom: t.spacing(4),
    paddingTop: t.spacing(6),
  },
  carousel: {
    gridArea: 'carousel',
    paddingBottom: t.spacing(5),
  },
}))

export default function Showcase() {
  const classes = useStyles()

  return (
    <M.Container maxWidth="lg" className={classes.root}>
      <div className={classes.text}>
        <Bar color="primary" />
        <M.Box mt={5}>
          <M.Typography variant="h1" color="textPrimary">
            Publish and discover unlimited data
          </M.Typography>
        </M.Box>
        <M.Box mt={4}>
          <M.Typography variant="body1" color="textSecondary">
            {/* TODO: copy */}
            Quilt is a web catalog and Python client powered by AWS services in your
            private cloud. Quilt is a web catalog and Python client powered by AWS
            services in your private cloud. Quilt is a web catalog and Python client
            powered by AWS services in your private cloud.
          </M.Typography>
        </M.Box>
        <M.Box mt={4}>
          <M.Link color="textPrimary" underline="none" href="TODO">
            Learn more
            <M.Icon color="primary" style={{ verticalAlign: 'middle' }}>
              chevron_right
            </M.Icon>
          </M.Link>
        </M.Box>
      </div>
      <Carousel className={classes.carousel} slides={slides} />
    </M.Container>
  )
}
