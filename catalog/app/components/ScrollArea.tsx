import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import useResizeObserver from 'use-resize-observer'

const useStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
    position: 'relative',
  },
  bottom: {
    animation: `$showBottom 150ms ease-out`,
    bottom: 0,
    // t.shadows[2], but projected upwards
    boxShadow: `
      0 -1px 5px 0 rgba(0,0,0,0.12),
      0 -2px 2px 0 rgba(0,0,0,0.14),
      0 -3px 1px -2px rgba(0,0,0,0.2)`,
  },
  button: {
    background: t.palette.background.default,
    position: 'absolute',
    right: 0,
    left: 0,
    zIndex: 1,
  },
  container: {
    height: '100%',
    overflow: 'hidden auto',
  },
  fullHeight: {
    alignContent: 'start',
    display: 'grid',
    gridRowGap: t.spacing(2),
    gridTemplateRows: 'auto',
  },
  hideScroll: {
    scrollbarWidth: 'none',
  },
  top: {
    animation: `$showTop 150ms ease-out`,
    boxShadow: t.shadows[2],
    top: 0,
  },
  '@keyframes showBottom': {
    '0%': {
      transform: 'translateY(16px)',
    },
    '100%': {
      transform: 'translateY(0)',
    },
  },
  '@keyframes showTop': {
    '0%': {
      transform: 'translateY(-16px)',
    },
    '100%': {
      transform: 'translateY(0)',
    },
  },
}))

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
  hideScroll?: boolean
  step?: number
}

export default function ScrollArea({
  children,
  className,
  hideScroll = false,
  step = 64,
}: ScrollAreaProps) {
  const classes = useStyles()
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [showTop, setShowTop] = React.useState(false)
  const [showBottom, setShowBottom] = React.useState(false)

  const toTop = React.useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    scrollEl.scrollTo({
      top: Math.max(scrollEl.scrollTop - step, 0),
      behavior: 'smooth',
    })
  }, [step])
  const toBottom = React.useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    scrollEl.scrollTo({
      top: Math.min(scrollEl.scrollTop + step, scrollEl.scrollHeight || 0),
      behavior: 'smooth',
    })
  }, [step])

  const invalidateScroll = React.useCallback((scrollEl: HTMLDivElement) => {
    setShowTop(scrollEl.scrollTop > 0)
    setShowBottom(scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight)
  }, [])
  const onScroll = React.useCallback(
    (event: Event) => {
      invalidateScroll(event.currentTarget as HTMLDivElement)
    },
    [invalidateScroll],
  )
  const onResize = React.useCallback(() => {
    if (!scrollRef.current) return
    invalidateScroll(scrollRef.current)
  }, [invalidateScroll])
  const { ref: heightRef } = useResizeObserver({ onResize })

  React.useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    scrollEl.addEventListener('scroll', onScroll)
    return () => {
      scrollEl.removeEventListener('scroll', onScroll)
    }
  }, [onScroll])

  return (
    <div className={cx(classes.root, className)}>
      <div
        className={cx(classes.container, { [classes.hideScroll]: hideScroll })}
        ref={scrollRef}
      >
        <div className={classes.fullHeight} ref={heightRef}>
          {children}
        </div>
      </div>
      {showTop && (
        <div className={cx(classes.button, classes.top)}>
          <M.Button fullWidth onClick={toTop}>
            <M.Icon fontSize="small">keyboard_arrow_up</M.Icon>
          </M.Button>
        </div>
      )}
      {showBottom && (
        <div className={cx(classes.button, classes.bottom)}>
          <M.Button fullWidth onClick={toBottom}>
            <M.Icon fontSize="small">keyboard_arrow_down</M.Icon>
          </M.Button>
        </div>
      )}
    </div>
  )
}
