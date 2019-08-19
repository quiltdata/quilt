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
          img={{ srcs: [search, search2x], offset: 42, width: 307 }}
          heading="Search"
        >
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
          temporincididunt
        </Highlight>
        <Highlight
          img={{ srcs: [versioning, versioning2x], offset: 84, width: 334 }}
          heading="Versioning"
        >
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
          temporincididunt
        </Highlight>
        <Highlight
          img={{ srcs: [preview, preview2x], offset: 87, width: 315 }}
          heading="Preview"
        >
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
          temporincididunt
        </Highlight>
        <Highlight
          img={{ srcs: [python, python2x], offset: 84, width: 334 }}
          heading="Python API"
        >
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
          temporincididunt
        </Highlight>
        <Highlight
          img={{ srcs: [catalog, catalog2x], offset: 60, width: 310 }}
          heading="Web Catalog"
        >
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
          temporincididunt
        </Highlight>
      </Grid>
      <M.Box pt={12} pb={10} textAlign="center">
        <M.Button variant="contained" color="secondary" href="">
          Try demo
        </M.Button>
      </M.Box>
    </M.Container>
  </>
)
