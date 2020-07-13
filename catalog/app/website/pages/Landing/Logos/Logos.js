import * as React from 'react'
import Carousel from 'react-multi-carousel'
import * as M from '@material-ui/core'

import logoAics from './logo-aics.png'
import logoCelsius from './logo-celsius.png'
import logoHudl from './logo-hudl.png'
import logoRibon from './logo-ribon.png'
import logoSight from './logo-sight.png'
import logoAI2 from './logo-ai2.png'
import logoNetguru from './logo-netguru.png'
import logoBT from './logo-bt.png'
import logoZee5 from './logo-zee5.png'

const logos = [
  {
    src: logoAics,
    title: 'Allen Institute for Cell Science',
  },
  {
    src: logoBT,
    title: 'BlackThorn Therapeutics',
  },
  {
    src: logoHudl,
    title: 'hudl',
  },
  {
    src: logoAI2,
    title: 'Allen Institute for AI',
  },
  {
    src: logoCelsius,
    title: 'Celsius',
  },
  {
    src: logoRibon,
    title: 'Ribon Therapeutics',
  },
  {
    src: logoSight,
    title: 'Sighthound',
  },
  {
    src: logoNetguru,
    title: 'Netguru',
  },
  {
    src: logoZee5,
    title: 'Zee5',
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: t.spacing(14),
    paddingTop: t.spacing(12),
    position: 'relative',
  },
  sliderContainer: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(9),
    maskImage:
      'linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 150px calc(100% - 150px), rgba(0,0,0,0))',
    overflow: 'hidden',
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      marginLeft: 'calc((100vw - 600px) / 2)',
      marginRight: 'calc((100vw - 600px) / 2)',
      minWidth: 600,
    },
  },
  slider: {
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    position: 'relative',
    transformStyle: 'preserve-3d',
    willChange: 'transform, transition',
  },
  item: {
    display: 'flex',
    justifyContent: 'center',
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
  },
  img: {
    display: 'block',
    maxHeight: 64,
    maxWidth: 240,
  },
}))

export default function Logos() {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      <M.Container maxWidth="lg">
        <M.Typography variant="h1" color="textPrimary" align="center">
          Companies that love Quilt
        </M.Typography>
      </M.Container>
      <Carousel
        responsive={{
          xxl: {
            breakpoint: { max: 3000, min: 1800 },
            items: 5,
          },
          xl: {
            breakpoint: { max: 1800, min: 1500 },
            items: 4,
          },
          lg: {
            breakpoint: { max: 1500, min: 1200 },
            items: 3,
          },
          md: {
            breakpoint: { max: 1200, min: 800 },
            items: 2,
          },
          sm: {
            breakpoint: { max: 800, min: 0 },
            items: 1,
          },
        }}
        sliderClass={classes.slider}
        itemClass={classes.item}
        containerClass={classes.sliderContainer}
        arrows={false}
        infinite
        centerMode
        focusOnSelect
        autoPlay
        autoPlaySpeed={5000}
      >
        {logos.map((l) => (
          <img
            key={l.title}
            title={l.title}
            alt={l.title}
            src={l.src}
            className={classes.img}
          />
        ))}
      </Carousel>
    </div>
  )
}
