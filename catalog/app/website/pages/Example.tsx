import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

// import Backlight1 from 'website/components/Backgrounds/Backlight1'
// import Backlight4 from 'website/components/Backgrounds/Backlight4'
import O1 from 'website/components/Backgrounds/Overlay1Full'
import O2 from 'website/components/Backgrounds/Overlay2'
import Dots from 'website/components/Backgrounds/Dots'
import Bar from 'website/components/Bar'
import Layout from 'website/components/Layout'
import Slides from 'website/components/Slides'

import slide1 from 'website/components/Screenshots/chloropleth.png'
import slide2 from 'website/components/Screenshots/overview.png'

export default function LandingExample() {
  return (
    <Layout>
      <MetaTitle>Example Landing Page</MetaTitle>
      <Dots />
      <O1 />
      <O2 />
      <Title
        center
        primary="Quilt is a Data Hub for Biotech"
        secondary={
          <>
            You can use Quilt to transform scattered, unlabeled data into reproducible,
            discoverable, and trusted datasets in the cloud. With Quilt, your company will
            discover drugs, targets, and models faster.
          </>
        }
      />
      <SlideBlock slides={[slide1, slide2]} />
      <SlideBlock slides={[slide1]} alt />
      {/* TODO: hero section w/ CTAs */}
      {/* TODO: detail text (?centered, alt bg), CTAs */}
      {/* TODO: tabs */}
      {/* TODO: quotes (single?, w/ and w/o avatats?) */}
      {/* TODO: title + CTAs */}
      {/* TODO: sticky footer? */}
    </Layout>
  )
}

export function SectionContainer(props: M.ContainerProps) {
  return (
    <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }} {...props} />
  )
}

interface TitleProps {
  primary: React.ReactNode
  secondary?: React.ReactNode
  center?: true
  children?: React.ReactNode
}

export function Title({ primary, secondary, center, children }: TitleProps) {
  const align = center && 'center'
  return (
    <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
      <M.Box
        display="flex"
        flexDirection="column"
        alignItems={{ sm: align }}
        pt={8}
        pb={5}
      >
        <Bar color="primary" />
        <M.Box pt={5} textAlign={{ sm: align }}>
          <M.Typography variant="h1" color="textPrimary">
            {primary}
          </M.Typography>
        </M.Box>
        {!!secondary && (
          <M.Box pt={3} pb={3} textAlign={{ sm: align }} maxWidth="35rem">
            <M.Typography variant="body1" color="textSecondary">
              {secondary}
            </M.Typography>
          </M.Box>
        )}
        {children}
      </M.Box>
    </M.Container>
  )
}

const useSlidesStyles = M.makeStyles((t) => ({
  root: {},
  alt: {
    // TODO: alt bg
    background: '#319',
  },
  slidesContainer: {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: t.spacing(10),
    paddingTop: t.spacing(10),
  },
  slides: {
    maxWidth: '50rem',
  },
}))

interface SlideBlockProps {
  alt?: true
}

export function SlideBlock({
  slides,
  disableCaptions,
  alt,
}: SlideBlockProps & Parameters<typeof Slides>[0]) {
  const classes = useSlidesStyles()
  return (
    <div className={cx(classes.root, alt && classes.alt)}>
      <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
        <div className={classes.slidesContainer}>
          <Slides {...{ slides, disableCaptions }} className={classes.slides} />
        </div>
      </M.Container>
    </div>
  )
}
