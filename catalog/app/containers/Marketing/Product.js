import * as React from 'react'

import { unstable_Box as Box } from '@material-ui/core/Box'
import { Button, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import * as Layout from 'components/Layout'

import Bar from './Bar'
import Bullet from './Bullet'
import Illustration from './Illustration'
import Theme from './Theme'

import backlight from './backlight1.png'
import dots from './dots.png'
import overlay1 from './overlay1.png'
import overlay2 from './overlay2.png'
import artProductDetail from './product-detail.png'
import artProductDetail2 from './product-detail@2x.png'
import artWho from './product-who-is-it-for.png'
import artWho2 from './product-who-is-it-for@2x.png'
import artWhy from './product-why-use.png'
import artWhy2 from './product-why-use@2x.png'
import artFeatures from './product-key-features.png'
import artFeatures2 from './product-key-features@2x.png'

// TODO: share
const ASSET_WIDTH = 1920

// TODO: share
const offset = (o = 0) => `calc(${o}px - (${ASSET_WIDTH}px - 100vw) / 2)`

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

const Overlay1 = styled('div')({
  backgroundImage: `url(${overlay1})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 741,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const Overlay2 = styled('div')({
  backgroundImage: `url(${overlay2})`,
  backgroundPosition: `top left ${offset()}`,
  backgroundSize: 'cover',
  height: 1105,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const H = ({ color, children, ...props }) => (
  <Box mb={3} {...props}>
    <Bar color={color} mb={5} />
    <Typography variant="h1">{children}</Typography>
  </Box>
)

const P = ({ children, ...props }) => (
  <Box mb={5} {...props}>
    <Typography variant="body1" color="textSecondary">
      {children}
    </Typography>
  </Box>
)

const SectionDetail = (props) => (
  <Box position="relative" {...props}>
    <Illustration
      srcs={[artProductDetail, artProductDetail2]}
      dir="right"
      width={919}
      height={743}
      offset={177}
    />
    <Box maxWidth={320} position="absolute" top={72}>
      <H color="primary">Product detail</H>
      <P>Quilt is continuous integration and deployment for data science.</P>
      <Box>
        <Button variant="contained" color="primary" href="">
          Buy now
        </Button>
        <Box display="inline-block" ml={2} />
        <Button variant="contained" color="secondary" href="">
          Request Demo
        </Button>
      </Box>
    </Box>
  </Box>
)

const SectionWho = (props) => (
  <Box position="relative" {...props}>
    <Illustration
      srcs={[artWho, artWho2]}
      dir="left"
      width={924}
      height={924}
      offset={276}
    />
    <Box maxWidth={448} position="absolute" top={304} right={0}>
      <H color="primary">Who is it for?</H>
      <P>The S3 catalog is for data-driven teams, data scientists, and data engineers.</P>
      <Button variant="contained" color="primary" href="">
        Learn more
      </Button>
    </Box>
  </Box>
)

const SectionWhy = (props) => (
  <Box position="relative" {...props}>
    <Illustration
      srcs={[artWhy, artWhy2]}
      dir="right"
      width={924}
      height={924}
      offset={242}
    />
    <Box maxWidth={416} position="absolute" top={216}>
      <H color="secondary">Why use the S3 Data Catalog</H>
      <P>
        Get everyone on the same page with a central data hub Make your data powerfully
        FAIR (findable, accessible, interoperable, reusable) All of your data in one
        place, versioned and backed up A home for all of your Jupyter experiments Store
        and version data that won&apos;t fit in git.
      </P>
      <Button variant="contained" color="secondary" href="">
        Learn more
      </Button>
    </Box>
  </Box>
)

const SectionFeatures = (props) => (
  <Box position="relative" {...props}>
    <Illustration
      srcs={[artFeatures, artFeatures2]}
      dir="left"
      width={765}
      height={957}
      offset={191}
    />
    <Box maxWidth={512} position="absolute" top={256} right={0}>
      <H color="primary">Key features</H>
      {/* TODO: fancy bullet style */}
      <Bullet color="primary">Search through all of your Jupyter notebooks</Bullet>
      <Bullet color="secondary">
        Rollback and recover with versioning and data packages
      </Bullet>
      <Bullet color="tertiary">
        Document all of your data with beautiful visualizations, markdown, and images
      </Bullet>
      <Bullet color="primary">
        Preview what&apos;s in S3 without downloading a single file Move data from Python
        to S3 and back
      </Bullet>
      <Button variant="contained" color="primary" href="">
        Learn more
      </Button>
    </Box>
  </Box>
)

export default () => (
  <Theme>
    <Layout.Layout
      pre={
        <Layout.Container>
          <Backlight />
          <Pattern />
          <Overlay2 />
          <Overlay1 />
          <SectionDetail mt={18} />
          <SectionWho mt={18} />
          <SectionWhy mt={12} />
          <SectionFeatures mt={6} mb={16} />
        </Layout.Container>
      }
    />
  </Theme>
)
