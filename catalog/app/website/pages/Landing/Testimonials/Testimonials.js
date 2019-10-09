import * as R from 'ramda'
import * as React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { mod } from 'react-swipeable-views-core'
import { autoPlay, virtualize } from 'react-swipeable-views-utils'
import * as M from '@material-ui/core'

import DotPagination from 'website/components/DotPagination'
import baxley from './people/baxley.jpeg'
import brown from './people/brown.jpeg'
import goldman from './people/goldman.jpeg'
import jackowski from './people/jackowski.jpeg'
import karr from './people/karr.jpeg'
import knaap from './people/knaap.jpeg'
import mrukwa from './people/mrukwa.jpeg'
import prawiro from './people/prawiro.jpeg'

const Swipeable = autoPlay(virtualize(SwipeableViews))

const testimonials = [
  {
    avatar: jackowski,
    name: 'Krzysztof Jackowski',
    title: 'Deputy Mobile Engineering Manager, Netguru',
    contents: (
      <>
        <p>
          CarLens was the most challenging project I&apos;ve ever worked on. I&apos;ve
          done all the DON&apos;Ts of managing an R&amp;D ML project, learning how
          complicated it is to recognize a car and distinguish which model it is.
        </p>
        <p>
          We&apos;ve learned how important a quality data set us and the way it is
          managed. That&apos;s why we integrated an amazing tool Quilt, which is like
          Github for data. Thanks for presenting this tool to the world.
        </p>
      </>
    ),
  },
  {
    avatar: brown,
    name: 'Jackson Brown',
    title: 'Research Engineer, Allen Institute for Cell Science',
    contents: (
      <p>
        Quilt helps us maximize the dissemination of our data to the scientific community
        by simplifying downloads, allowing data versioning, and seamless integration with
        Jupyter Notebooks.
      </p>
    ),
  },
  {
    avatar: knaap,
    name: 'Eli Knaap',
    title: 'Center for Geospatial Sciences',
    contents: (
      <p>
        Quilt has been an incredibly useful addition to our stack. It lets us focus on
        developing novel spatial analytics while providing a wealth of data for our users
        to apply them on. It also lets us distribute bespoke data products along with our
        code, which is a game-changer, particularly for academic and research software.
      </p>
    ),
  },
  {
    avatar: mrukwa,
    name: 'Grzegorz Mrukwa',
    title: 'Senior Machine Learning Engineer, Netguru',
    contents: (
      <>
        <p>
          Quilt simplified our flow in data maintenance and versioning. It became
          extremely easy to keep track of changes in a data set and refer in a
          reproducible manner to a specific revision without worrying if someone
          overwrites the data.
        </p>
        <p>
          We have Quilt integrated into our flow, so the data set updates interfere with
          model building no more.
        </p>
        <p>
          At this moment we use Quilt for versioning models (especially that we generate
          models in a bunch of formats each time) and Jupyter Notebooks (for which Git
          isn&apos;t the best option).
        </p>
      </>
    ),
  },
  {
    avatar: baxley,
    name: 'Bob Baxley',
    title: 'CTO, Bastille Labs',
    contents: (
      <>
        <p>
          Quilt has been extremely useful in helping Bastille organize our data sets for
          model training. Before Quilt, we used a hodgepodge of S3 buckets and local NAS
          drive locations to store data. But we had issues with versioning and tracking
          data set changes. By referencing data sets through Quilt versions and hashes, it
          is much easier to make immutable analysis notebooks that don&apos;t break as
          data sets evolve.
        </p>
        <p>
          We also love the Quilt web interface, which makes it much easier for the entire
          organization to discover data sets. Before Quilt, our only mechanism to data set
          discovery was listing S3 buckets.
        </p>
      </>
    ),
  },
  {
    avatar: karr,
    name: 'Jonathan Karr',
    title: 'Fellow, Icahn Institute for Data Science at Mount Sinai',
    contents: (
      <>
        <p>
          Along with Git and Docker, Quilt is an essential tool that enables us to
          collaboratively model entire cells.
        </p>
      </>
    ),
  },
  {
    avatar: goldman,
    name: 'Casey Goldman',
    title: 'CEO, Dataland',
    contents: (
      <>
        <p>
          Quilt has been incredibly useful to us in sharing data sets with our clients and
          managing access to them. Quilt handles versioning and packaging with no effort
          on our part, which allows us to be able to share our analysis externally with
          ease.
        </p>
        <p>
          Clients are able to import the transformed data sets into their workflow with
          full portability. Definitely worth trying out!
        </p>
      </>
    ),
  },
  {
    avatar: prawiro,
    name: 'Guenevere Prawiroatmodjo',
    title: 'Data Scientist, Perfect Day',
    contents: (
      <p>
        Quilt is a great way for our team to find, inspect, and share their data sets via
        the web.
      </p>
    ),
  },
]

const SLIDE_COUNT_FACTOR = 1000000
const maxSlides = testimonials.length * SLIDE_COUNT_FACTOR

const useStyles = M.makeStyles((t) => ({
  root: {
    // max height values are computed manually based on the actual heights of the slides,
    // so it's important to keep them up-to-date when editing the quotes to keep the
    // slider from pushing the contents below when playing through the slides
    minHeight: 830, // for md+
    paddingTop: t.spacing(15),
    [t.breakpoints.down('sm')]: {
      minHeight: 940,
    },
    [t.breakpoints.down('xs')]: {
      minHeight: 1120,
    },
  },
  overflow: {
    overflowX: 'hidden',
  },
  container: {
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

export default function Testimonials() {
  const classes = useStyles()
  const [index, setIndex] = React.useState(0)
  const onChangeIndex = React.useCallback(R.unary(setIndex), [])
  const actualIndex = mod(index, testimonials.length)
  const nearestZero = Math.floor(index / testimonials.length) * testimonials.length

  const goToNearestIndex = React.useCallback((i) => setIndex(nearestZero + i), [
    nearestZero,
  ])

  const slideRenderer = React.useCallback(({ index: i, key }) => {
    const t = testimonials[mod(i, testimonials.length)]
    return (
      <div className={classes.slide} key={key}>
        <img className={classes.avatar} src={t.avatar} alt={t.name} />
        <div className={classes.name}>{t.name}</div>
        <div className={classes.title}>{t.title}</div>
        <div className={classes.contents}>{t.contents}</div>
      </div>
    )
  }, [])

  return (
    <M.Container maxWidth="lg" className={classes.root}>
      <div className={classes.overflow}>
        <Swipeable
          disableLazyLoading
          enableMouseEvents
          animateHeight
          index={index}
          interval={7000}
          onChangeIndex={onChangeIndex}
          slideRenderer={slideRenderer}
          slideCount={maxSlides}
          className={classes.container}
        />
      </div>
      <DotPagination
        mt={4}
        mb={8}
        total={testimonials.length}
        current={actualIndex}
        onChange={goToNearestIndex}
      />
    </M.Container>
  )
}
