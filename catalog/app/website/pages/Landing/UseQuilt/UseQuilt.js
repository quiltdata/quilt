import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'
import Bullet from 'website/components/Bullet'
import Illustration from 'website/components/Illustration'
import * as Personas from 'website/components/Personas'

import partnerBadge from './partner.png'

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

export default () => (
  <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
    <M.Box display="flex" flexDirection="column" alignItems="center">
      <Bar color="primary" />
      <M.Box mt={5}>
        <M.Typography variant="h1" color="textPrimary">
          Get your data to the cloud
        </M.Typography>
      </M.Box>
      <M.Box mt={4} mb={5} maxWidth={570}>
        <M.Typography variant="body1" color="textSecondary">
          <p>
            Quilt runs in a virtual private cloud in your AWS account. Your data reside in
            secure services that are only accessible to individuals whom you designate.
          </p>
          <p>
            Quilt runs as a CloudFormation stack that orchestrates services in your AWS
            account. (Services like AWS S3, Fargate, ElasticSearch, Lambda, Athena, and
            CloudTrail.) These services form the Quilt backend that powers the Quilt web
            catalog and <code>quilt3</code> Python client. Every file in Quilt is a
            versioned S3 object secured by IAM.
          </p>
        </M.Typography>
      </M.Box>
      <M.Box
        component="img"
        alt="APN Standard Technology Partner Badge"
        src={partnerBadge}
        width={200}
      />
    </M.Box>

    <Section mt={{ xs: 15, md: 3 }}>
      <Illustration {...Personas.DataScientists} dir="left" />
      <SectionContents pb={{ xs: 0, md: 15 }} pt={{ xs: 6, md: 24 }}>
        <M.Typography variant="h2" color="textPrimary">
          Data engineers & IT
        </M.Typography>
        <M.Box mt={6} mb={3}>
          <Bullet color="primary">
            Get everyone on your team using S3, so that{' '}
            <em>
              all of your critical data is in one secure, audit-able, and compliant
              location
            </em>
            .
          </Bullet>
          <Bullet color="tertiary">
            Spin up Quilt so that your core infrastructure is done and your users
            &mdash;from data scientists to executives&mdash; can self serve from
            high-performance data formats like Parquet, using nothing more than a simple
            web URL to your private Quilt catalog. Now you are free to focus on advanced
            infrastructure (instead of one-off requests for data dumps, ETL jobs, or
            temporary S3 buckets).
          </Bullet>
          <Bullet color="secondary">
            Create and distribute read-only, immutable data sets that one can mess up, and
            that allow you to diagnose and recover from errors via automatic data version
            control.
          </Bullet>
        </M.Box>
        <M.Button variant="contained" color="primary" href="">
          Learn more
        </M.Button>
      </SectionContents>
    </Section>
    <Section mt={{ xs: 20, md: 0 }}>
      <Illustration {...Personas.DataEngineers} dir="right" order={{ xs: 0, md: 1 }} />
      <SectionContents pb={{ xs: 0, md: 20 }} pt={{ xs: 6, md: 32 }}>
        <M.Typography variant="h2" color="textPrimary">
          Data scientists
        </M.Typography>
        <M.Box mt={6} mb={3}>
          <Bullet color="primary">
            Store and version your Jupyter notebooks, and all of their data dependencies,
            at a scale that git can&apos;t handle.
          </Bullet>
          <Bullet color="tertiary">
            Share notebooks, analyses, and data sets in a beautiful, documented format
            that anyone can read an understand. Instead of making PowerPoint presentations
            to summarize your work, send links to notebooks and READMEs on the web and be
            done.
          </Bullet>
          <Bullet color="secondary">
            Share notebooks and complex machine learning projects with colleagues in a
            reusable format that they can extend, modify, and contribute back to Quilt.
          </Bullet>
        </M.Box>
        <M.Button variant="contained" color="secondary" href="">
          Learn more
        </M.Button>
      </SectionContents>
    </Section>

    <Section mt={{ xs: 20, md: 0 }}>
      <Illustration {...Personas.HeadOfDataScience} dir="left" />
      <SectionContents pb={{ xs: 0, md: 30 }} pt={{ xs: 6, md: 25 }}>
        <M.Typography variant="h2" color="textPrimary">
          Heads of data, executives
        </M.Typography>
        <M.Box mt={6} mb={3}>
          <Bullet color="secondary">
            Create a data-driven organization where everyone on the team has access to the
            latest, most accurate data, and can discover new data as questions arise.
          </Bullet>
          <Bullet color="primary">
            Empower your team to build smarter models faster by arming them with
            Quilt&apos;s advanced infrastructure for experimentation and decision support.
          </Bullet>
          <Bullet color="tertiary">
            Easily participate in the decision-making process by using the Quilt web
            catalog to view and understand the same data, visualizations, documentation,
            and notebooks that the data scientists and engineers are using every day.
          </Bullet>
          <Bullet color="secondary">
            Improve security, audit-ability, and compliance by centralizing your data in
            the worlds most advanced and popular cloud storage formats.
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
