import cx from 'classnames'
import * as React from 'react'
import Swipeable from 'react-swipeable-views'
import * as M from '@material-ui/core'

import Bullet from 'website/components/Bullet'

const BULLET_COLORS = ['primary', 'secondary', 'tertiary']

const useStyles = M.makeStyles((t) => ({
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: 960,
    [t.breakpoints.down('sm')]: {
      justifyContent: 'space-evenly',
    },
  },
  tab: {
    ...t.typography.h3,
    background: 'none',
    border: 'none',
    color: t.palette.text.primary,
    cursor: 'pointer',
    marginLeft: t.spacing(2),
    marginRight: t.spacing(2),
    marginTop: t.spacing(3),
    outline: 'none',
    paddingBottom: t.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    position: 'relative',
    whiteSpace: 'nowrap',
    '&::after': {
      borderBottom: `2px solid ${t.palette.secondary.light}`,
      left: 0,
      bottom: 0,
      content: '""',
      position: 'absolute',
      right: 0,
      transform: 'scaleX(0)',
      transition: t.transitions.create('transform', {
        duration: t.transitions.duration.shorter,
        easing: t.transitions.easing.easeOut,
      }),
      pointerEvents: 'none',
    },
    '&$current::after': {
      transform: 'scaleX(1)',
    },
  },
  current: {},
  overflow: {
    overflowX: 'hidden',
  },
  container: {
    width: `calc(100% + ${t.spacing(2)}px)`,
  },
  slide: {
    width: '100%',
    paddingRight: t.spacing(2),
    paddingTop: t.spacing(6),
  },
  slideInner: {
    borderRadius: 12,
    background: 'linear-gradient(to right, rgba(103,82,230,0.35), rgba(103,82,230,0.06))',
    [t.breakpoints.down('sm')]: {
      display: 'flex',
      flexDirection: 'column',
    },
  },
  bullets: {
    paddingBottom: t.spacing(10),
    paddingLeft: t.spacing(13),
    paddingTop: t.spacing(12),
    position: 'relative',
    [t.breakpoints.only('md')]: {
      paddingBottom: t.spacing(6),
      paddingLeft: t.spacing(7),
      paddingTop: t.spacing(8),
    },
    [t.breakpoints.down('sm')]: {
      paddingBottom: t.spacing(6),
      paddingLeft: t.spacing(7),
      paddingRight: t.spacing(7),
      paddingTop: t.spacing(6),
      '$img + &': {
        paddingTop: 0,
      },
    },
    [t.breakpoints.down('xs')]: {
      paddingBottom: t.spacing(4),
      paddingLeft: t.spacing(3),
      paddingRight: t.spacing(3),
    },
  },
  img: {
    display: 'block',
    marginBottom: t.spacing(2),
    [t.breakpoints.up('md')]: {
      float: 'right',
      marginLeft: t.spacing(2),
      marginRight: t.spacing(3),
    },
    [t.breakpoints.only('md')]: {
      marginLeft: t.spacing(-8),
      transform: 'scale(0.8)',
      transformOrigin: 'top right',
    },
    [t.breakpoints.down('sm')]: {
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: `calc(100% - ${t.spacing(6)}px)`,
    },
  },
}))

export interface TabsImg extends M.BoxProps {
  src: string
  width: number
}

export interface TabsSection {
  title: string
  bullets: React.ReactNode[]
  img?: TabsImg
}

export interface TabsProps {
  sections: TabsSection[]
}

export function Tabs({ sections }: TabsProps) {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback((i: number) => setIndex(i), [])

  return (
    <>
      <div className={classes.tabs}>
        {sections.map((s, i) => (
          <button
            key={s.title}
            className={cx(classes.tab, i === index && classes.current)}
            onClick={() => setIndex(i)}
            type="button"
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className={classes.overflow}>
        <Swipeable
          disableLazyLoading
          enableMouseEvents
          index={index}
          onChangeIndex={onChangeIndex}
          className={classes.container}
        >
          {sections.map((s) => (
            <div key={s.title} className={classes.slide}>
              <div className={classes.slideInner}>
                {!!s.img && (
                  // @ts-expect-error
                  <M.Box component="img" alt="" className={classes.img} {...s.img} />
                )}
                <div className={classes.bullets}>
                  {s.bullets.map((b, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Bullet key={i} color={BULLET_COLORS[i % BULLET_COLORS.length]} dense>
                      {b}
                    </Bullet>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </Swipeable>
      </div>
    </>
  )
}

export default Tabs
