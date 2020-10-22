import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { mod } from 'react-swipeable-views-core'
import { virtualize } from 'react-swipeable-views-utils'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Bar from 'website/components/Bar'
import scrollIntoView from 'utils/scrollIntoView'

import adornment from './adornment.png'

const Swipeable = virtualize(SwipeableViews)

const SLIDE_COUNT_FACTOR = 1000000

const videos = [
  {
    title: 'Overview',
    src:
      'https://www.youtube.com/embed/videoseries?list=PLmXfD6KoA_vArp85tMod7apo2UTeC3khq',
  },
]

const maxSlides = videos.length * SLIDE_COUNT_FACTOR

const getVideo = (i) => videos[mod(i, videos.length)]

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: t.spacing(5),
    paddingTop: t.spacing(12),
    position: 'relative',
    zIndex: 1,
  },
  adornment: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    '&::before': {
      background: `center / contain no-repeat url(${adornment})`,
      content: '""',
      height: '39vw',
      position: 'absolute',
      width: '100vw',
    },
  },
  overflow: {
    background: t.palette.common.black,
    overflowX: 'hidden',
    position: 'relative',
    width: '100%',
    '@media (max-width: 1500px)': {
      maxWidth: 900,
    },
  },
  container: {
    width: `calc(100% + ${t.spacing(2)}px)`,
  },
  slide: {
    paddingBottom: `calc((100% - ${t.spacing(2)}px) * 0.5625)`,
    paddingRight: t.spacing(2),
    position: 'relative',
    width: '100%',
  },
  iframe: {
    height: '100%',
    position: 'absolute',
    width: `calc(100% - ${t.spacing(2)}px)`,
  },
  btns: {
    marginRight: t.spacing(-1),
    paddingTop: t.spacing(1),
    textAlign: 'center',
  },
  btn: {
    ...t.typography.body2,
    background: fade(t.palette.secondary.main, 0.3),
    border: 'none',
    borderRadius: 2,
    color: t.palette.text.primary,
    cursor: 'pointer',
    display: 'inline-block',
    lineHeight: t.typography.pxToRem(28),
    marginRight: t.spacing(1),
    marginTop: t.spacing(1),
    outline: 'none',
    paddingBottom: 0,
    paddingLeft: t.spacing(2),
    paddingRight: t.spacing(2),
    paddingTop: 0,
  },
  btnCurrent: {
    background: t.palette.secondary.main,
  },
}))

export default function Videos() {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = R.unary(setIndex)
  const nearestZero = Math.floor(index / videos.length) * videos.length
  const goToNearestIndex = (i) => setIndex(nearestZero + i)

  const slideRenderer = React.useCallback(
    ({ index: i, key }) => (
      <div className={classes.slide} key={key}>
        <iframe
          frameBorder="0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={classes.iframe}
          src={getVideo(i).src}
          title={getVideo(i).title}
        />
      </div>
    ),
    [classes.iframe, classes.slide],
  )

  return (
    <M.Container maxWidth="lg" className={classes.root}>
      <M.Typography
        variant="h1"
        color="textPrimary"
        align="center"
        id="demo-video"
        ref={scrollIntoView()}
      >
        Drive every decision with data
      </M.Typography>
      <M.Box mt={3} mb={5} maxWidth={720}>
        <M.Typography variant="body1" color="textSecondary" align="center">
          Bring your team together around a data portal that is accessible to everyone
          &mdash; from business users, to analysts, to developers.
        </M.Typography>
      </M.Box>
      <div className={classes.adornment}>
        <div className={classes.overflow}>
          <Swipeable
            disableLazyLoading
            enableMouseEvents
            index={index}
            onChangeIndex={onChangeIndex}
            slideRenderer={slideRenderer}
            slideCount={maxSlides}
            className={classes.container}
          />
        </div>
      </div>
      {videos.length > 1 && (
        <>
          <M.Box mt={5} mb={4}>
            <Bar color="secondary" />
          </M.Box>
          <M.Typography variant="body1" color="textSecondary" align="center">
            Quilt covers dozens of data-driven use cases. Select a topic below for a
            video.
          </M.Typography>
          <div className={classes.btns}>
            {videos.map((v, i) => (
              <button
                key={v.title}
                className={cx(
                  classes.btn,
                  i === mod(index, videos.length) && classes.btnCurrent,
                )}
                type="button"
                onClick={() => goToNearestIndex(i)}
              >
                {v.title}
              </button>
            ))}
          </div>
        </>
      )}
    </M.Container>
  )
}
