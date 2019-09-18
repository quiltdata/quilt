import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { mod } from 'react-swipeable-views-core'
import { autoPlay, virtualize } from 'react-swipeable-views-utils'
import * as M from '@material-ui/core'

const Swipeable = autoPlay(virtualize(SwipeableViews))

const SLIDE_COUNT_FACTOR = 10000

const useStyles = M.makeStyles((t) => ({
  slide: {
    width: '100%',
  },
  caption: {
    marginTop: t.spacing(4.5),
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(4.5),
  },
  dot: {
    // TODO
    background: '#999',
    border: 'none',
    borderRadius: '50%',
    height: 12,
    padding: 0,
    width: 12,
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  current: {
    background: '#99f',
  },
}))

export default function Carousel({ className, slides }) {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback(R.unary(setIndex), [])
  const actualIndex = mod(index, slides.length)
  const current = slides[actualIndex]

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
      <Swipeable
        disableLazyLoading
        enableMouseEvents
        index={index}
        onChangeIndex={onChangeIndex}
        slideRenderer={slideRenderer}
        slideCount={slides.length * SLIDE_COUNT_FACTOR}
      />
      <M.Typography
        variant="body1"
        color="textSecondary"
        align="center"
        className={classes.caption}
      >
        {current.caption}
      </M.Typography>
      <div className={classes.dots}>
        {slides.map((s, i) => (
          <button
            type="button"
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            // TODO: set nearest index
            onClick={() => setIndex(i)}
            className={cx(classes.dot, actualIndex === i && classes.current)}
          />
        ))}
      </div>
    </div>
  )
}
