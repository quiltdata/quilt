import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { mod } from 'react-swipeable-views-core'
import { autoPlay, virtualize } from 'react-swipeable-views-utils'
import * as M from '@material-ui/core'

const Swipeable = autoPlay(virtualize(SwipeableViews))

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
  dots: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(4),
  },
  dot: {
    background: M.colors.blueGrey[500],
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    height: 12,
    outline: 'none',
    padding: 0,
    position: 'relative',
    width: 12,
    '&::before': {
      background: `linear-gradient(to top, #5c83ea, #6752e6)`,
      borderRadius: '50%',
      bottom: 0,
      boxShadow: [[0, 0, 16, 0, '#6072e9']],
      content: '""',
      left: 0,
      opacity: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      transition: 'opacity 400ms',
    },
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  current: {
    '&::before': {
      opacity: 1,
    },
  },
}))

export default function Carousel({ className, slides }) {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback(R.unary(setIndex), [])
  const current = slides[mod(index, slides.length)]
  const maxSlides = slides.length * SLIDE_COUNT_FACTOR
  const nearestZero = Math.floor(index / slides.length) * slides.length
  const goToNearestIndex = (i) => setIndex(nearestZero + i)

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
    <div className={className}>
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
      <div className={classes.dots}>
        {slides.map((s, i) => (
          <button
            type="button"
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            onClick={() => goToNearestIndex(i)}
            className={cx(classes.dot, current === s && classes.current)}
          />
        ))}
      </div>
    </div>
  )
}
