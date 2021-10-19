import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'
import Bar from 'website/components/Bar'
import Tabs from 'website/components/Tabs'

import artEng from './art-eng.png'
import artEng2x from './art-eng@2x.png'
import artSci from './art-sci.png'
import artSci2x from './art-sci@2x.png'
import artHead from './art-head.png'
import artHead2x from './art-head@2x.png'
import artExe from './art-exe.png'
import artExe2x from './art-exe@2x.png'

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
        Create and distribute read-only, immutable data sets that no one can mess up, and
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
    title: 'Heads of data',
    img: {
      src: img2x(artHead, artHead2x),
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
  {
    title: 'Executives',
    img: {
      src: img2x(artExe, artExe2x),
      width: 220,
      mt: -32 / 8,
    },
    bullets: [
      <>Maximize Your Return on Data.</>,
      <>
        Turn S3 into a business-user friendly catalogue of all your data with configurable
        access for your tech users, business users, and customers.
      </>,
      <>Reduce costs by improving data searchability and accessibility.</>,
      <>Reduce errors and increase velocity by making data centralized and immutable.</>,
      <>
        Improve security, compliance by centralizing your data in the world’s most
        advanced and popular cloud storage formats.
      </>,
    ],
  },
]

export default function UseQuilt() {
  return (
    <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
      <M.Box display="flex" flexDirection="column" alignItems={{ sm: 'center' }} mt={8}>
        <Bar color="primary" />
        <M.Box mt={5} maxWidth={520} textAlign={{ sm: 'center' }}>
          <M.Typography variant="h1" color="textPrimary">
            Accelerate from experiment to impact
          </M.Typography>
        </M.Box>
        <M.Box mt={4} mb={5} maxWidth={620}>
          <M.Typography variant="body1" color="textSecondary">
            Quilt is a unified source of information for everyone who needs to make
            decisions based on data. Stop emailing files, making decks, and scrambling to
            put together reports. Empower your team to self-serve with Quilt. Ensure that
            everyone is looking at the same data thanks to versioning.
          </M.Typography>
        </M.Box>
      </M.Box>

      <Tabs sections={SECTIONS} />
    </M.Container>
  )
}
