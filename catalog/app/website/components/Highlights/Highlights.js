import * as React from 'react'
import { Box, Button, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import * as Layout from 'components/Layout'

import Bar from './Bar'
import Illustration from './Illustration'

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

const Grid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 210px)',
  justifyContent: 'space-between',
})

const Highlight = ({ img, heading, children }) => (
  <Box mt={8}>
    <Illustration srcs={img.srcs} offset={img.offset} width={img.width} height={380} />
    <Typography variant="h4">{heading}</Typography>
    <Box mt={3}>
      <Typography variant="body2" color="textSecondary">
        {children}
      </Typography>
    </Box>
  </Box>
)

export default () => (
  <Layout.Container position="relative">
    <Box display="flex" flexDirection="column" alignItems="center" pt={20} pb={2}>
      <Bar color="secondary" />
      <Box mt={5}>
        <Typography variant="h1">Product Highlights</Typography>
      </Box>
    </Box>
    <Grid>
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
    <Box pt={15} textAlign="center">
      <Button variant="contained" color="secondary" href="">
        Try demo
      </Button>
    </Box>
  </Layout.Container>
)
