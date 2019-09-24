import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import Backlight from 'website/components/Backgrounds/Backlight3'
import Bar from 'website/components/Bar'
import Illustration from 'website/components/Illustration'

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

const Grid = styled(M.Box)(({ theme: t }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 210px)',
  justifyContent: 'space-between',
  maxWidth: 1000,

  [t.breakpoints.only('sm')]: {
    gridTemplateColumns: 'repeat(2, 210px)',
    width: 600,
  },

  [t.breakpoints.only('xs')]: {
    gridTemplateColumns: '210px',
    justifyContent: 'center',
  },
}))

const Highlight = ({ img, heading, children }) => (
  <M.Box mt={{ xs: 12, md: 8 }}>
    <Illustration {...img} alwaysAbsolute height={380} />
    <M.Typography variant="h4" color="textPrimary">
      {heading}
    </M.Typography>
    <M.Box mt={3}>
      <M.Typography variant="body2" color="textSecondary">
        {children}
      </M.Typography>
    </M.Box>
  </M.Box>
)

export default () => (
  <>
    <M.Box position="relative">
      <Backlight top={-750} />
    </M.Box>
    <M.Container maxWidth="lg" style={{ position: 'relative' }}>
      <M.Box display="flex" flexDirection="column" alignItems="center" pt={10} pb={2}>
        <Bar color="secondary" />
        <M.Box mt={5}>
          <M.Typography variant="h1" color="textPrimary" align="center">
            Product Highlights
          </M.Typography>
        </M.Box>
      </M.Box>
      <Grid mx="auto">
        <Highlight
          img={{ srcs: [catalog, catalog2x], offset: 60, width: 310 }}
          heading="Share unlimited data"
        >
          <p>Work with huge files that don&apos;t fit on GitHub.</p>
          <p>
            Turn informal projects into beautiful data sets that contain Jupyter
            notebooks, models, images, visualizations, and markdown.
          </p>
          <p>
            Make sense of existing S3 buckets and data lakes, or let the Quilt backend
            manage S3 for you.
          </p>
        </Highlight>
        <Highlight
          img={{ srcs: [search, search2x], offset: 42, width: 307 }}
          heading="Understand your data"
        >
          <p>Visualize your data with more than 25 visualizations.</p>
          <p>Automatically summarize the contents of S3 buckets.</p>
          <p>
            Preview large files without downloading them (Parquet, VCF, Excel, gzips, and
            more).
          </p>
        </Highlight>
        <Highlight
          img={{ srcs: [versioning, versioning2x], offset: 84, width: 334 }}
          heading="Discover related data"
        >
          <p>
            Search through every file your team has. Find all files relevant to the
            question at hand.
          </p>
          <p>Discover new connections between data sets.</p>
          <p>Enrich analysis with petabytes of public data on open.quiltdata.com.</p>
        </Highlight>
        <Highlight
          img={{ srcs: [python, python2x], offset: 84, width: 334 }}
          heading="Model your data"
        >
          <p>
            Version notebooks, models, and training sets so that you can travel time,
            reproduce past results, diagnose and recover from errors.
          </p>
          <p>
            Run experiments faster by capturing notebooks and all of their data in the
            form of reusable, modifiable data packages.
          </p>
        </Highlight>
        <Highlight
          img={{ srcs: [preview, preview2x], offset: 87, width: 315 }}
          heading="Decide faster"
        >
          <p>
            Executives and team leads&mdash;anyone with a web browser&mdash; can use Quilt
            to view, search, and visualize the same data, visualizations, and notebooks
            that data scientists and data engineers use for modeling.
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
            Document every decision with charts, notebooks, and tables. Audit past
            decisions with automatic data versioning.
          </p>
        </Highlight>
      </Grid>
      <M.Box pt={12} pb={10} textAlign="center"></M.Box>
    </M.Container>
  </>
)
