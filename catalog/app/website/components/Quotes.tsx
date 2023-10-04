import * as R from 'ramda'
import * as React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { mod } from 'react-swipeable-views-core'
import { autoPlay, virtualize } from 'react-swipeable-views-utils'
import * as M from '@material-ui/core'

import useMemoEq from 'utils/useMemoEq'
import DotPagination from 'website/components/DotPagination'

const Swipeable = autoPlay(virtualize(SwipeableViews))

const SLIDE_COUNT_FACTOR = 1000000

const useStyles = M.makeStyles((t) => ({
  container: {
    // max height values are computed manually based on the actual heights of the slides,
    // so it's important to keep them up-to-date when editing the quotes to keep the
    // slider from pushing the contents below when playing through the slides
    minHeight: 720, // for sm+
    paddingTop: t.spacing(15),
    position: 'relative',
    zIndex: 1,
    [t.breakpoints.down('xs')]: {
      minHeight: 960,
    },
  },
  overflow: {
    overflowX: 'hidden',
  },
  slideContainer: {
    width: `calc(100% + ${t.spacing(2)}px)`,
  },
  slide: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    paddingRight: t.spacing(2),
    position: 'relative',
    width: '100%',
  },
  avatar: {
    borderRadius: '50%',
    height: 132,
    width: 132,
  },
  name: {
    ...t.typography.h4,
    color: t.palette.text.primary,
    marginBottom: t.spacing(1),
    marginTop: t.spacing(4),
  },
  title: {
    ...t.typography.body1,
    color: t.palette.secondary.main,
    lineHeight: 1.5,
    textAlign: 'center',
  },
  contents: {
    paddingTop: t.spacing(1),
    position: 'relative',
    [t.breakpoints.up('md')]: {
      maxWidth: 860,
      paddingLeft: t.spacing(4),
      paddingRight: t.spacing(4),
    },
    '& p': {
      ...t.typography.body2,
      color: t.palette.text.secondary,
      marginTop: t.spacing(3),
      position: 'relative',
      zIndex: 1,
    },
    '&::before, &::after': {
      color: t.palette.common.white,
      fontSize: '15rem',
      lineHeight: 1,
      opacity: 0.1,
      position: 'absolute',
      quotes: '"“" "”"',
    },
    '&::before': {
      content: 'open-quote',
      left: -11,
      top: '-0.07em',
    },
    '&::after': {
      bottom: '-0.65em',
      content: 'close-quote',
      right: -8,
    },
  },
}))

interface Quote {
  avatar?: string
  name: string
  title: string
  contents: React.ReactNode
}

interface QuotesProps {
  quotes: Quote[]
}

export default function Quotes({ quotes }: QuotesProps) {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback((i: number) => setIndex(i), [])
  const maxSlides = quotes.length > 1 ? quotes.length * SLIDE_COUNT_FACTOR : 1
  const actualIndex = mod(index, quotes.length)
  const nearestZero = Math.floor(index / quotes.length) * quotes.length

  const goToNearestIndex = React.useCallback(
    (i: number) => setIndex(nearestZero + i),
    [nearestZero],
  )

  const quotesMemo = useMemoEq(quotes, R.identity)

  const slideRenderer = React.useCallback(
    ({ index: i, key }: { index: number; key: number | string }) => {
      const q = quotesMemo[mod(i, quotesMemo.length)]
      return (
        <div className={classes.slide} key={key}>
          {!!q.avatar && <img className={classes.avatar} src={q.avatar} alt={q.name} />}
          <div className={classes.name}>{q.name}</div>
          <div className={classes.title}>{q.title}</div>
          <div className={classes.contents}>{q.contents}</div>
        </div>
      )
    },
    [
      quotesMemo,
      classes.slide,
      classes.avatar,
      classes.name,
      classes.title,
      classes.contents,
    ],
  )

  return (
    <M.Container maxWidth="lg" className={classes.container}>
      <div className={classes.overflow}>
        <Swipeable
          disableLazyLoading
          enableMouseEvents
          // FIXME: height is zero until first slide change event
          animateHeight
          index={index}
          interval={7000}
          onChangeIndex={onChangeIndex}
          slideRenderer={slideRenderer}
          slideCount={maxSlides}
          className={classes.slideContainer}
        />
      </div>
      {quotes.length > 1 && (
        <DotPagination
          mt={4}
          mb={8}
          total={quotes.length}
          current={actualIndex}
          onChange={goToNearestIndex}
        />
      )}
    </M.Container>
  )
}
