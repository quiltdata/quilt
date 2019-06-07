import * as React from 'react'

import { Box, Grid, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import * as Layout from 'components/Layout'

import Bar from './Bar'
import Bullet from './Bullet'
import Illustration from './Illustration'
import Theme from './Theme'

import backlight from './backlight1.png'
import dots from './dots.png'
import personaScientist from './persona-data-scientists.png'
import personaScientist2x from './persona-data-scientists@2x.png'
import personaEngineer from './persona-data-engineers.png'
import personaEngineer2x from './persona-data-engineers@2x.png'
import personaHead from './persona-head-of-data-science.png'
import personaHead2x from './persona-head-of-data-science@2x.png'

const Backlight = styled('div')({
  backgroundImage: `url(${backlight})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1449,
  left: 0,
  position: 'absolute',
  right: 0,
})

const Pattern = styled('div')({
  backgroundImage: `url(${dots})`,
  backgroundRepeat: 'repeat',
  backgroundSize: 101,
  height: 1790,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

// TODO: fancy rainbow bullets
const Scientist = (props) => (
  <Box {...props}>
    <Grid container>
      <Grid item sm={7}>
        <Illustration
          srcs={[personaScientist, personaScientist2x]}
          dir="left"
          width={843}
          offset={265}
        />
      </Grid>
      <Grid item sm={5}>
        <Box>
          <Bar color="primary" mb={5} />
          <Typography variant="h1">Data scientists</Typography>
          <Box mt={5}>
            <Bullet color="primary">
              Find any Jupyter notebook you&apos;ve ever touched with powerful search
            </Bullet>
            <Bullet color="secondary">
              Store unlimited amounts of data in any format
            </Bullet>
            <Bullet color="tertiary">
              Version and back up everything, including large data that doesn&apos;t fit
              on GitHub
            </Bullet>
            <Bullet color="primary">
              Share Jupyter notebooks that just work on any machine
            </Bullet>
            <Bullet color="secondary">
              Share and discover notebooks and models from your colleagues
            </Bullet>
            <Bullet color="tertiary">
              Seamlessly move Python objects from memory to S3 and back
            </Bullet>
            <Bullet color="primary">Collaboratively assemble large data sets</Bullet>
            <Bullet color="secondary">Ensure data quality with data unit tests</Bullet>
          </Box>
        </Box>
      </Grid>
    </Grid>
  </Box>
)

const Engineer = (props) => (
  <Box {...props}>
    <Grid container>
      <Grid item sm={5}>
        <Box pt={16} pb={16}>
          <Bar color="secondary" mb={5} />
          <Typography variant="h1">Data engineers</Typography>
          <Box mt={5}>
            <Bullet color="primary">
              Data science infrastructure in a box - no more data busy work for you
            </Bullet>
            <Bullet color="secondary">
              Read, write, and preview Parquet files in S3
            </Bullet>
            <Bullet color="tertiary">Fewer errors, less downtime</Bullet>
            <Bullet color="primary">
              Insulate code from unintended data changes by building from immutable blocks
            </Bullet>
            <Bullet color="secondary">Ensure data quality with data unit tests</Bullet>
          </Box>
        </Box>
      </Grid>
      <Grid item sm={7}>
        <Illustration
          srcs={[personaEngineer, personaEngineer2x]}
          dir="right"
          width={730}
          offset={230}
        />
      </Grid>
    </Grid>
  </Box>
)

const Head = (props) => (
  <Box {...props}>
    <Grid container>
      <Grid item sm={7}>
        <Illustration
          srcs={[personaHead, personaHead2x]}
          dir="left"
          width={743}
          offset={170}
        />
      </Grid>
      <Grid item sm={5}>
        <Box pt={12} pb={5}>
          <Bar color="tertiary" mb={5} />
          <Typography variant="h1">Head of data science</Typography>
          <Box mt={5}>
            <Bullet color="primary">Central hub for all data and models</Bullet>
            <Bullet color="secondary">
              Accessible to technical and non-technical users
            </Bullet>
            <Bullet color="tertiary">Experiment faster</Bullet>
            <Bullet color="primary">Get deploys right the first time</Bullet>
            <Bullet color="secondary">Fewer errors, less downtime</Bullet>
            <Bullet color="tertiary">Audit every data access ever</Bullet>
            <Bullet color="primary">
              Run your data through a rigorous approval and testing process
            </Bullet>
          </Box>
        </Box>
      </Grid>
    </Grid>
  </Box>
)

export default () => (
  <Theme>
    <Layout.Layout
      pre={
        <Layout.Container>
          <Backlight />
          <Pattern />
          <Scientist mt={16} position="relative" />
          <Engineer mt={16} position="relative" />
          <Head mt={16} mb={16} />
        </Layout.Container>
      }
    />
  </Theme>
)
