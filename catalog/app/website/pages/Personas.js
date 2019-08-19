import * as React from 'react'
import * as M from '@material-ui/core'

import Backlight from 'website/components/Backgrounds/Backlight1'
import Dots from 'website/components/Backgrounds/Dots'
import Bar from 'website/components/Bar'
import Bullet from 'website/components/Bullet'
import Illustration from 'website/components/Illustration'
import Layout from 'website/components/Layout'
import * as Personas from 'website/components/Personas'

const Section = (props) => (
  <M.Box
    display="flex"
    flexDirection={{ xs: 'column', md: 'row' }}
    justifyContent="space-between"
    {...props}
  />
)

const SectionContents = (props) => (
  <M.Box
    alignItems={{ xs: 'center', md: 'flex-start' }}
    display="flex"
    flexDirection="column"
    width={{ xs: '100%', md: '21rem', lg: `${(5 / 12) * 100}%` }}
    {...props}
  />
)

const Scientist = (props) => (
  <Section {...props}>
    <Illustration {...Personas.DataScientists} dir="left" />
    <SectionContents pb={{ xs: 0, md: 0 }} pt={{ xs: 8, md: 5 }}>
      <Bar color="primary" mb={5} />
      <M.Typography variant="h1" color="textPrimary">
        Data scientists
      </M.Typography>
      <M.Box mt={5}>
        <Bullet color="primary">
          Find any Jupyter notebook you&apos;ve ever touched with powerful search
        </Bullet>
        <Bullet color="secondary">Store unlimited amounts of data in any format</Bullet>
        <Bullet color="tertiary">
          Version and back up everything, including large data that doesn&apos;t fit on
          GitHub
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
      </M.Box>
    </SectionContents>
  </Section>
)

const Engineer = (props) => (
  <Section {...props}>
    <Illustration {...Personas.DataEngineers} dir="right" order={{ xs: 0, md: 1 }} />
    <SectionContents pb={{ xs: 0, md: 16 }} pt={{ xs: 8, md: 20 }}>
      <Bar color="secondary" mb={5} />
      <M.Typography variant="h1" color="textPrimary">
        Data engineers
      </M.Typography>
      <M.Box mt={5}>
        <Bullet color="primary">
          Data science infrastructure in a box - no more data busy work for you
        </Bullet>
        <Bullet color="secondary">Read, write, and preview Parquet files in S3</Bullet>
        <Bullet color="tertiary">Fewer errors, less downtime</Bullet>
        <Bullet color="primary">
          Insulate code from unintended data changes by building from immutable blocks
        </Bullet>
        <Bullet color="secondary">Ensure data quality with data unit tests</Bullet>
      </M.Box>
    </SectionContents>
  </Section>
)

const Head = (props) => (
  <Section {...props}>
    <Illustration {...Personas.HeadOfDataScience} dir="left" />
    <SectionContents pb={{ xs: 0, md: 10 }} pt={{ xs: 8, md: 12 }}>
      <Bar color="secondary" mb={5} />
      <M.Typography variant="h1" color="textPrimary">
        Head of data science
      </M.Typography>
      <M.Box mt={5}>
        <Bullet color="primary">Central hub for all data and models</Bullet>
        <Bullet color="secondary">Accessible to technical and non-technical users</Bullet>
        <Bullet color="tertiary">Experiment faster</Bullet>
        <Bullet color="primary">Get deploys right the first time</Bullet>
        <Bullet color="secondary">Fewer errors, less downtime</Bullet>
        <Bullet color="tertiary">Audit every data access ever</Bullet>
        <Bullet color="primary">
          Run your data through a rigorous approval and testing process
        </Bullet>
      </M.Box>
    </SectionContents>
  </Section>
)

export default () => (
  <Layout>
    <M.Box position="relative">
      <Backlight />
      <Dots />
    </M.Box>
    <M.Container maxWidth="lg" style={{ position: 'relative' }}>
      <Scientist mt={{ xs: 10, md: 16 }} position="relative" />
      <Engineer mt={{ xs: 20, md: 16 }} position="relative" />
      <Head mt={{ xs: 20, md: 16 }} mb={{ xs: 10, md: 16 }} />
    </M.Container>
  </Layout>
)
