import * as R from 'ramda'
import * as React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { mod } from 'react-swipeable-views-core'
import { autoPlay, virtualize } from 'react-swipeable-views-utils'
import * as M from '@material-ui/core'

import useMemoEq from 'utils/useMemoEq'

import DotPagination from 'website/components/DotPagination'

const Swipeable = autoPlay(virtualize(SwipeableViews))

interface SlideWithCaption {
  src: string
  caption?: React.ReactNode
}

type SlideInput = SlideWithCaption | string

const SLIDE_COUNT_FACTOR = 1000000
const AUTO_SCROLL_INTERVAL = 7000

const getSrc = (s: SlideInput) => (typeof s === 'string' ? s : s.src)

const getCaption = (s: SlideInput) => (typeof s === 'string' ? undefined : s.caption)

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

interface SlidesProps extends React.HTMLAttributes<HTMLDivElement> {
  slides: SlideInput[]
  disableCaptions?: true
}

export default function Slides({ slides, disableCaptions, ...props }: SlidesProps) {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback((i: number) => setIndex(i), [])
  const actualIndex = mod(index, slides.length)
  const current = slides[actualIndex]
  const maxSlides = slides.length > 1 ? slides.length * SLIDE_COUNT_FACTOR : 1
  const nearestZero = Math.floor(index / slides.length) * slides.length
  const slidesMemo = useMemoEq(slides, R.identity)

  const disableCaptionsComputed = React.useMemo(() => {
    if (disableCaptions) return disableCaptions
    return slidesMemo.every((s) => !getCaption(s))
  }, [disableCaptions, slidesMemo])

  const goToNearestIndex = React.useCallback(
    (i: number) => setIndex(nearestZero + i),
    [nearestZero],
  )

  const slideRenderer = React.useCallback(
    ({ index: i, key }: { index: number; key: number | string }) => (
      <img
        className={classes.slide}
        key={key}
        src={getSrc(slidesMemo[mod(i, slidesMemo.length)])}
        alt=""
      />
    ),
    [slidesMemo, classes.slide],
  )

  return (
    <div {...props}>
      <div className={classes.overflow}>
        <Swipeable
          disableLazyLoading
          enableMouseEvents
          index={index}
          interval={AUTO_SCROLL_INTERVAL}
          onChangeIndex={onChangeIndex}
          slideRenderer={slideRenderer}
          slideCount={maxSlides}
          className={classes.container}
        />
      </div>
      {!disableCaptionsComputed && (
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
                {getCaption(s)}
              </M.Typography>
            </M.Fade>
          ))}
        </div>
      )}
      {slides.length > 1 && (
        <DotPagination
          mt={4}
          total={slides.length}
          current={actualIndex}
          onChange={goToNearestIndex}
        />
      )}
    </div>
  )
}
