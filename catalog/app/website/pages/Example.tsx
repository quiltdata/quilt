import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

// import Backlight1 from 'website/components/Backgrounds/Backlight1'
// import Backlight4 from 'website/components/Backgrounds/Backlight4'
import O1 from 'website/components/Backgrounds/Overlay1Full'
import O2 from 'website/components/Backgrounds/Overlay2'
import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'
import Lede from 'website/components/Lede'
import Quotes from 'website/components/Quotes'
import Section from 'website/components/Section'
import SlideBlock from 'website/components/SlideBlock'

import slide1 from 'website/components/Screenshots/chloropleth.png'
import slide2 from 'website/components/Screenshots/overview.png'

export default function LandingExample() {
  return (
    <Layout>
      <MetaTitle>Example Landing Page</MetaTitle>
      <Dots />
      <O1 />
      <O2 />
      <Lede
        variant="center"
        heading="Quilt is a Data Hub for Biotech"
        detail={
          <>
            You can use Quilt to transform scattered, unlabeled data into reproducible,
            discoverable, and trusted datasets in the cloud. With Quilt, your company will
            discover drugs, targets, and models faster.
          </>
        }
      />
      <Section>
        <SlideBlock slides={[slide1, slide2]} />
      </Section>
      <Section>
        <Quotes
          quotes={[
            {
              name: 'Jackson Brown',
              title: 'Research Engineer, Allen Institute for Cell Science',
              contents: (
                <p>
                  Quilt helps us maximize the dissemination of our data to the scientific
                  community by simplifying downloads, allowing data versioning, and
                  seamless integration with Jupyter Notebooks.
                </p>
              ),
            },
            {
              name: 'Eli Knaap',
              title: 'Center for Geospatial Sciences',
              contents: (
                <p>
                  Quilt has been an incredibly useful addition to our stack. It lets us
                  focus on developing novel spatial analytics while providing a wealth of
                  data for our users to apply them on. It also lets us distribute bespoke
                  data products along with our code, which is a game-changer, particularly
                  for academic and research software.
                </p>
              ),
            },
          ]}
        />
      </Section>
      <Section bg="fancy">
        <SlideBlock slides={[slide1]} />
      </Section>
      <Section>
        <M.Box maxWidth="50rem" pt={10} pb={10}>
          <M.Typography variant="h6" color="textPrimary">
            Quilt is a Data Hub for Biotech
          </M.Typography>
          <M.Box pt={2} />
          <M.Typography variant="body2" color="textSecondary">
            You can use Quilt to transform scattered, unlabeled data into reproducible,
            discoverable, and trusted datasets in the cloud. With Quilt, your company will
            discover drugs, targets, and models faster.
          </M.Typography>
          <M.Box pt={2} />
          <M.Typography variant="body2" color="textSecondary">
            Your team is rapidly accumulating data from instruments, CROs, scientists, and
            executives. But naively storing data adds cost without benefit. Data without
            context (labels, documentation, links, and charts) quickly becomes
            meaningless. Decision quality suffers, experiments are needlessly repeated,
            and teams waste months doing "data archaeology" on past results.
          </M.Typography>
        </M.Box>
      </Section>
    </Layout>
  )
}
