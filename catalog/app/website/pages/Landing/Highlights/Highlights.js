import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'
// import Backlight from 'website/components/Backgrounds/Backlight3'
import Bar from 'website/components/Bar'

import search from './highlights-search.png'
import search2x from './highlights-search@2x.png'
import versioning from './highlights-versioning.png'
import versioning2x from './highlights-versioning@2x.png'
import preview from './highlights-preview.png'
import preview2x from './highlights-preview@2x.png'
import python from './highlights-python.png'
import python2x from './highlights-python@2x.png'
import catalog from './highlights-catalog.png'
import catalog2x from './highlights-catalog@2x.png'

const HIGHLIGHTS = [
  {
    img: {
      srcs: [catalog, catalog2x],
      offsetY: 10,
      width: 207, // 207x196
    },
    heading: 'Share unlimited data',
    contents: (
      <>
        <p>Work with huge files that don&apos;t fit on GitHub.</p>
        <p>
          Turn informal projects into beautiful data sets that contain Jupyter notebooks,
          models, images, visualizations, and markdown.
        </p>
        <p>
          Make sense of existing S3 buckets and data lakes, or let the Quilt backend
          manage S3 for you.
        </p>
      </>
    ),
  },
  {
    img: {
      srcs: [search, search2x],
      offsetY: 18,
      offsetX: -10,
      width: 213, // 213x183
    },
    heading: 'Understand your data',
    contents: (
      <>
        <p>Visualize your data with more than 25 visualizations.</p>
        <p>Automatically summarize the contents of S3 buckets.</p>
        <p>
          Preview large files without downloading them (Parquet, VCF, Excel, gzips, and
          more).
        </p>
      </>
    ),
  },
  {
    img: {
      srcs: [versioning, versioning2x],
      offsetY: 0,
      width: 163, // 163x213
    },
    heading: 'Discover related data',
    contents: (
      <>
        <p>
          Search through every file your team has. Find all files relevant to the question
          at hand.
        </p>
        <p>Discover new connections between data sets.</p>
        <p>Enrich analysis with petabytes of public data on open.quiltdata.com.</p>
      </>
    ),
  },
  {
    img: {
      srcs: [python, python2x],
      offsetY: 15,
      width: 152, // 152x176
    },
    heading: 'Model your data',
    contents: (
      <>
        <p>
          Version notebooks, models, and training sets so that you can travel time,
          reproduce past results, diagnose and recover from errors.
        </p>
        <p>
          Run experiments faster by capturing notebooks and all of their data in the form
          of reusable, modifiable data packages.
        </p>
      </>
    ),
  },
  {
    img: {
      srcs: [preview, preview2x],
      offsetY: 6,
      width: 130, // 130x192
    },
    heading: 'Decide faster',
    contents: (
      <>
        <p>
          Executives and team leads&mdash;anyone with a web browser&mdash;can use Quilt to
          view, search, and visualize the same data, visualizations, and notebooks that
          data scientists and data engineers use for modeling.
        </p>
        <p>
          Data analysts can stop making decks and stop emailing files. Instead, invite
          stakeholders to view data, charts, and notebooks directly in Quilt.
        </p>
        <p>
          Get access to more of your company&apos;s data. Grant access to stakeholders
          with a simple email. Armed with more information, your team can make smarter
          decisions.
        </p>
        <p>
          Document every decision with charts, notebooks, and tables. Audit past decisions
          with automatic data versioning.
        </p>
      </>
    ),
  },
]

const useStyles = M.makeStyles((t) => ({
  highlights: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    [t.breakpoints.down('md')]: {
      width: `calc(100% + ${t.spacing(4)}px)`,
      marginLeft: -t.spacing(2),
      marginRight: -t.spacing(2),
    },
  },
  highlight: {
    paddingLeft: t.spacing(4),
    paddingRight: t.spacing(4),
    paddingTop: t.spacing(12),
    width: `${100 / 3}%`,
    [t.breakpoints.down('md')]: {
      paddingLeft: t.spacing(2),
      paddingRight: t.spacing(2),
    },
    [t.breakpoints.down('sm')]: {
      width: '50%',
    },
    [t.breakpoints.down('xs')]: {
      maxWidth: 400,
      width: '100%',
    },
  },
  bg: {
    background: 'linear-gradient(to bottom, #2f306e, #222455)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  img: {
    display: 'block',
    height: 215,
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: -t.spacing(8),
    objectFit: 'contain',
    position: 'relative',
  },
  heading: {
    ...t.typography.h3,
    color: t.palette.text.primary,
    marginTop: t.spacing(3),
    textAlign: 'center',
    [t.breakpoints.between('sm', 'md')]: {
      ...t.typography.h4,
    },
  },
  contents: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    paddingBottom: t.spacing(4),
    paddingTop: t.spacing(1),
    paddingLeft: t.spacing(3),
    paddingRight: t.spacing(3),
    [t.breakpoints.between('sm', 'md')]: {
      paddingBottom: t.spacing(3),
      paddingLeft: t.spacing(2),
      paddingRight: t.spacing(2),
    },
    '& p': {
      marginBottom: 0,
      marginTop: t.spacing(2),
    },
  },
}))

export default function Highlights() {
  const classes = useStyles()
  return (
    <>
      {/*
      <M.Box position="relative">
        <Backlight top={-750} />
      </M.Box>
      */}
      <M.Container maxWidth="lg" style={{ position: 'relative' }}>
        <M.Box display="flex" flexDirection="column" alignItems="center" pt={20} pb={2}>
          <Bar color="secondary" />
          <M.Box mt={5}>
            <M.Typography variant="h1" color="textPrimary" align="center">
              Make informed decisions as a team
            </M.Typography>
          </M.Box>
          <M.Box mt={5} textAlign={{ xs: 'center', md: 'unset' }} maxWidth={800}>
            <M.Typography variant="body1" color="textSecondary" gutterBottom>
              Bring your team together around a visual data repository that is accessible
              to everyone on the team&mdash;
              <em>from business users, to analysts, to developers</em>.
            </M.Typography>
            <M.Typography variant="body1" color="textSecondary">
              Share, understand, discover, model, and decide with Quilt.
            </M.Typography>
          </M.Box>
        </M.Box>

        <div className={classes.highlights}>
          {HIGHLIGHTS.map((h, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className={classes.highlight}>
              <div className={classes.bg}>
                <img
                  alt=""
                  src={img2x(...h.img.srcs)}
                  className={classes.img}
                  style={{
                    width: h.img.width,
                    objectPosition: `center ${h.img.offsetY}px`,
                    left: h.img.offsetX,
                  }}
                />
                <div className={classes.heading}>{h.heading}</div>
                <div className={classes.contents}>{h.contents}</div>
              </div>
            </div>
          ))}
        </div>
      </M.Container>
    </>
  )
}
