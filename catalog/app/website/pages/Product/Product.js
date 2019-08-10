import * as React from 'react'
import * as M from '@material-ui/core'

import Backlight from 'website/components/Backgrounds/Backlight1'
import Dots from 'website/components/Backgrounds/Dots'
import Overlay1 from 'website/components/Backgrounds/Overlay1'
import Overlay2 from 'website/components/Backgrounds/Overlay2'
import Bar from 'website/components/Bar'
import Bullet from 'website/components/Bullet'
import Illustration from 'website/components/Illustration'
import Layout from 'website/components/Layout'

import artProductDetail from './product-detail.png'
import artProductDetail2 from './product-detail@2x.png'
import artWho from './product-who-is-it-for.png'
import artWho2 from './product-who-is-it-for@2x.png'
import artWhy from './product-why-use.png'
import artWhy2 from './product-why-use@2x.png'
import artFeatures from './product-key-features.png'
import artFeatures2 from './product-key-features@2x.png'

const H = ({ color, children, ...props }) => (
  <M.Box mb={3} {...props}>
    <Bar color={color} mb={5} />
    <M.Typography variant="h1" color="textPrimary">
      {children}
    </M.Typography>
  </M.Box>
)

const P = ({ children, ...props }) => (
  <M.Box mb={5} {...props}>
    <M.Typography variant="body1" color="textSecondary">
      {children}
    </M.Typography>
  </M.Box>
)

const Section = (props) => (
  <M.Box position="relative" display="flex" flexDirection="column" {...props} />
)

const ContentBox = (props) => (
  <M.Box
    position={{ xs: 'static', md: 'absolute' }}
    mt={{ xs: 3, md: 0 }}
    mx="auto"
    {...props}
  />
)

const Art = ({ height, width, ...props }) => (
  <Illustration
    width={width}
    height={{ xs: 'auto', md: height }}
    mx={{ xs: 'auto', md: 'unset' }}
    maxWidth={{ xs: width / 2, md: 'unset' }}
    {...props}
  />
)

const SectionDetail = (props) => (
  <Section {...props}>
    <Art
      srcs={[artProductDetail, artProductDetail2]}
      width={919}
      height={743}
      offset={177}
      dir="right"
    />
    <ContentBox maxWidth={320} top={72}>
      <H color="primary">Product detail</H>
      <P>Quilt is continuous integration and deployment for data science.</P>
      <M.Box>
        <M.Button variant="contained" color="primary" href="">
          Buy now
        </M.Button>
        <M.Box display="inline-block" ml={2} />
        <M.Button variant="contained" color="secondary" href="">
          Request Demo
        </M.Button>
      </M.Box>
    </ContentBox>
  </Section>
)

const SectionWho = (props) => (
  <Section {...props}>
    <Art srcs={[artWho, artWho2]} width={924} height={924} offset={276} dir="left" />
    <ContentBox maxWidth={{ xs: 320, md: 320, lg: 448 }} top={304} right={0}>
      <H color="primary">Who is it for?</H>
      <P>The S3 catalog is for data-driven teams, data scientists, and data engineers.</P>
      <M.Button variant="contained" color="primary" href="">
        Learn more
      </M.Button>
    </ContentBox>
  </Section>
)

const SectionWhy = (props) => (
  <Section {...props}>
    <Art srcs={[artWhy, artWhy2]} width={924} height={924} offset={242} dir="right" />
    <ContentBox maxWidth={{ xs: 360, lg: 416 }} top={216}>
      <H color="secondary">Why use the S3 Data Catalog</H>
      <P>
        Get everyone on the same page with a central data hub Make your data powerfully
        FAIR (findable, accessible, interoperable, reusable) All of your data in one
        place, versioned and backed up A home for all of your Jupyter experiments Store
        and version data that won&apos;t fit in git.
      </P>
      <M.Button variant="contained" color="secondary" href="">
        Learn more
      </M.Button>
    </ContentBox>
  </Section>
)

const SectionFeatures = (props) => (
  <Section {...props}>
    <Art
      srcs={[artFeatures, artFeatures2]}
      width={765}
      height={957}
      offset={191}
      dir="left"
    />
    <ContentBox maxWidth={{ xs: 424, lg: 512 }} top={256} right={0}>
      <H color="primary">Key features</H>
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
      <M.Button variant="contained" color="primary" href="">
        Learn more
      </M.Button>
    </ContentBox>
  </Section>
)

export default () => (
  <Layout>
    <M.Box position="relative">
      <Backlight />
      <Dots />
      <Overlay2 />
      <Overlay1 />
    </M.Box>
    <M.Container maxWidth="lg" style={{ position: 'relative' }}>
      <SectionDetail mt={{ xs: 10, md: 18 }} />
      <SectionWho mt={{ xs: 20, md: 18 }} />
      <SectionWhy mt={{ xs: 20, md: 12 }} />
      <SectionFeatures mt={{ xs: 20, md: 6 }} mb={15} />
    </M.Container>
  </Layout>
)
