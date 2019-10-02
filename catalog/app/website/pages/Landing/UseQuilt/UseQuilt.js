import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import Swipeable from 'react-swipeable-views'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'
import Bar from 'website/components/Bar'
import Bullet from 'website/components/Bullet'

import artEng from './art-eng.png'
import artEng2x from './art-eng@2x.png'
import artSci from './art-sci.png'
import artSci2x from './art-sci@2x.png'
import artExe from './art-exe.png'
import artExe2x from './art-exe@2x.png'

const BULLET_COLORS = ['primary', 'secondary', 'tertiary']

const SECTIONS = [
  {
    title: 'Data engineers & IT',
    img: {
      src: img2x(artEng, artEng2x),
      width: 501,
      mt: -24 / 8,
    },
    bullets: [
      <>
        Get everyone on your team using S3, so that{' '}
        <em>
          all of your critical data is in one secure, audit-able, and compliant location
        </em>
        .
      </>,
      <>
        Spin up Quilt so that your core infrastructure is done and your users&mdash;from
        data scientists to executives&mdash;can self serve from high-performance data
        formats like Parquet, using nothing more than a simple web URL to your private
        Quilt catalog. Now you are free to focus on advanced infrastructure (instead of
        one-off requests for data dumps, ETL jobs, or temporary S3 buckets).
      </>,
      <>
        Create and distribute read-only, immutable data sets that one can mess up, and
        that allow you to diagnose and recover from errors via automatic data version
        control.
      </>,
    ],
  },
  {
    title: 'Data scientists',
    img: {
      src: img2x(artSci, artSci2x),
      width: 478,
      mt: -36 / 8,
    },
    bullets: [
      <>
        Store and version your Jupyter notebooks, and all of their data dependencies, at a
        scale that git can&apos;t handle.
      </>,
      <>
        Share notebooks, analyses, and data sets in a beautiful, documented format that
        anyone can read an understand. Instead of making PowerPoint presentations to
        summarize your work, send links to notebooks and READMEs on the web and be done.
      </>,
      <>
        Share notebooks and complex machine learning projects with colleagues in a
        reusable format that they can extend, modify, and contribute back to Quilt.
      </>,
    ],
  },
  {
    title: 'Heads of data, executives',
    img: {
      src: img2x(artExe, artExe2x),
      width: 436,
      mt: -40 / 8,
    },
    bullets: [
      <>
        Create a data-driven organization where everyone on the team has access to the
        latest, most accurate data, and can discover new data as questions arise.
      </>,
      <>
        Empower your team to build smarter models faster by arming them with Quilt&apos;s
        advanced infrastructure for experimentation and decision support.
      </>,
      <>
        Easily participate in the decision-making process by using the Quilt web catalog
        to view and understand the same data, visualizations, documentation, and notebooks
        that the data scientists and engineers are using every day.
      </>,
      <>
        Improve security, audit-ability, and compliance by centralizing your data in the
        worlds most advanced and popular cloud storage formats.
      </>,
    ],
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {},
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
      paddingTop: 0,
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

export default function UseQuilt() {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback(R.unary(setIndex), [])
  return (
    <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
      <M.Box display="flex" flexDirection="column" alignItems="center">
        <Bar color="primary" />
        <M.Box mt={5}>
          <M.Typography variant="h1" color="textPrimary">
            Get your data to the cloud
          </M.Typography>
        </M.Box>
        <M.Box mt={4} mb={5} maxWidth={620}>
          <M.Typography variant="body1" color="textSecondary">
            Quilt runs in a virtual private cloud in your AWS account. Your data reside in
            secure services that are only accessible to individuals whom you designate.
          </M.Typography>
          <M.Box mt={3} />
          <M.Typography variant="body1" color="textSecondary">
            Quilt runs as a CloudFormation stack that orchestrates services in your AWS
            account. (Services like AWS S3, Fargate, ElasticSearch, Lambda, Athena, and
            CloudTrail.) These services form the Quilt backend that powers the Quilt web
            catalog and <code>quilt3</code> Python client. Every file in Quilt is a
            versioned S3 object secured by IAM.
          </M.Typography>
        </M.Box>
      </M.Box>

      <div className={classes.tabs}>
        {SECTIONS.map((s, i) => (
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
          {SECTIONS.map((s) => (
            <div key={s.title} className={classes.slide}>
              <div className={classes.slideInner}>
                <M.Box component="img" alt="" className={classes.img} {...s.img} />
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
    </M.Container>
  )
}
