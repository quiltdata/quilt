import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import Bar from 'website/components/Bar'
import Bullet from 'website/components/Bullet'
import Illustration from 'website/components/Illustration'
import * as Personas from 'website/components/Personas'

import amazon from './amazon.svg'

const Amazon = styled((props) => <img alt="Amazon logo" src={amazon} {...props} />)({
  width: 74,
  height: 74,
  objectFit: 'contain',
  opacity: 0.3,
})

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
    width={{ xs: '100%', md: '21rem', lg: `${5/12*100}%` }}
    {...props}
  />
)

export default () => (
  <M.Container maxWidth="lg" style={{ position: 'relative' }}>
    <M.Box display="flex" flexDirection="column" alignItems="center">
      <Bar color="primary" />
      <M.Box mt={5}>
        <M.Typography variant="h1" color="textPrimary">Why use Quilt?</M.Typography>
      </M.Box>
      <M.Box mt={4} mb={5} maxWidth={570}>
        <M.Typography variant="body1" color="textSecondary" align="center">
          Quilt makes machine learning data reproducible, auditable, and discoverable by
          providing a central hub for the continuous integration and deployment of data.
          Teams that use Quilt experiment faster, experience less downtime, and deploy
          their data with confidence.
        </M.Typography>
      </M.Box>
      <Amazon />
    </M.Box>

    <Section mt={{ xs: 15, md: 3 }}>
      <Illustration {...Personas.DataScientists} dir="left" />
      <SectionContents pb={{ xs: 0, md: 15 }} pt={{ xs: 6, md: 24 }}>
        <M.Typography variant="h2" color="textPrimary">Data scientists</M.Typography>
        <M.Box mt={6} mb={3}>
          <Bullet color="primary">
            Find any Jupyter notebook you&apos;ve ever touched with powerful search
          </Bullet>
          <Bullet color="tertiary">
            Version and back up everything, including large data that doesn&apos;t fit
            on GitHub
          </Bullet>
          <Bullet color="secondary">Ensure data quality with data unit tests</Bullet>
        </M.Box>
        <M.Button variant="contained" color="primary" href="">
          Learn more
        </M.Button>
      </SectionContents>
    </Section>

    <Section mt={{ xs: 20, md: 0 }}>
      <Illustration {...Personas.DataEngineers} dir="right" order={{ xs: 0, md: 1 }} />
      <SectionContents pb={{ xs: 0, md: 20 }} pt={{ xs: 6, md: 32 }}>
        <M.Typography variant="h2" color="textPrimary">Data engineers</M.Typography>
        <M.Box mt={6} mb={3}>
          <Bullet color="primary">
            Data science infrastructure in a box&mdash;no more data busy work for you
          </Bullet>
          <Bullet color="tertiary">
            Insulate code from unintended data changes by building from immutable blocks
          </Bullet>
          <Bullet color="secondary">Ensure data quality with data unit tests</Bullet>
        </M.Box>
        <M.Button variant="contained" color="secondary" href="">
          Learn more
        </M.Button>
      </SectionContents>
    </Section>

    <Section mt={{ xs: 20, md: 0 }}>
      <Illustration {...Personas.HeadOfDataScience} dir="left" />
      <SectionContents pb={{ xs: 0, md: 30 }} pt={{ xs: 6, md: 25 }}>
        <M.Typography variant="h2" color="textPrimary">Head of data science</M.Typography>
        <M.Box mt={6} mb={3}>
          <Bullet color="primary">Central hub for all data and models</Bullet>
          <Bullet color="tertiary">Audit every data access ever</Bullet>
          <Bullet color="secondary">
            Run your data through a rigorous approval and testing process
          </Bullet>
        </M.Box>
        <M.Button variant="contained" color="primary" href="">
          Learn more
        </M.Button>
      </SectionContents>
    </Section>

    <M.Box pb={10} />
  </M.Container>
)
