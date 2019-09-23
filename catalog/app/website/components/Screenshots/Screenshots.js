import * as R from 'ramda'
import * as React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { mod } from 'react-swipeable-views-core'
import { autoPlay, virtualize } from 'react-swipeable-views-utils'
import * as M from '@material-ui/core'

import DotPagination from 'website/components/DotPagination'

import slide1 from './chloropleth.png'
import slide2 from './overview.png'
import slide3 from './genomes-images.png'
import slide4 from './terrain-tiles.png'
import slide5 from './versions.png'
import slide6 from './packages.png'

const Swipeable = autoPlay(virtualize(SwipeableViews))

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

const SLIDE_COUNT_FACTOR = 1000000

const useStyles = M.makeStyles((t) => ({
  overflow: {
    overflowX: 'hidden',
  },
  container: {
    width: `calc(100% + ${t.spacing(2)}px)`,
  },
  slide: {
    width: '100%',
    paddingRight: t.spacing(2),
  },
  captionContainer: {
    height: t.typography.pxToRem(32),
    marginTop: t.spacing(5),
    position: 'relative',
  },
  caption: {
    position: 'absolute',
    width: '100%',
  },
}))

export default function Screenshots(props) {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback(R.unary(setIndex), [])
  const actualIndex = mod(index, slides.length)
  const current = slides[actualIndex]
  const maxSlides = slides.length * SLIDE_COUNT_FACTOR
  const nearestZero = Math.floor(index / slides.length) * slides.length

  const goToNearestIndex = React.useCallback((i) => setIndex(nearestZero + i), [
    nearestZero,
  ])

  const slideRenderer = React.useCallback(
    ({ index: i, key }) => (
      <img
        className={classes.slide}
        key={key}
        src={slides[mod(i, slides.length)].src}
        alt=""
      />
    ),
    [slides],
  )

  return (
    <div {...props}>
      <div className={classes.overflow}>
        <Swipeable
          disableLazyLoading
          enableMouseEvents
          index={index}
          interval={7000}
          onChangeIndex={onChangeIndex}
          slideRenderer={slideRenderer}
          slideCount={maxSlides}
          className={classes.container}
        />
      </div>
      <div className={classes.captionContainer}>
        {slides.map((s, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <M.Fade in={s === current} key={i}>
            <M.Typography
              variant="body1"
              color="textSecondary"
              align="center"
              className={classes.caption}
            >
              {s.caption}
            </M.Typography>
          </M.Fade>
        ))}
      </div>
      <DotPagination
        mt={4}
        total={slides.length}
        current={actualIndex}
        onChange={goToNearestIndex}
      />
    </div>
  )
}
