import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import LogosCarousel from 'website/pages/Landing/LogosCarousel'

import logoDspconcepts from 'website/pages/Landing/Logos/logo-dspconcepts.svg'
import logoDecibel from 'website/pages/Landing/Logos/logo-decibel.png'
import logoInari from 'website/pages/Landing/Logos/logo-inari.svg'
import logoHudl from 'website/pages/Landing/Logos/logo-hudl.png'
import logoNeumora from 'website/pages/Landing/Logos/logo-neumora.png'
import logoResilience from 'website/pages/Landing/Logos/logo-resilience.svg'
import logoTessera from 'website/pages/Landing/Logos/logo-tessera.png'

const logos = [
  {
    src: logoDecibel,
    title: 'Decibel Therapeutics',
  },
  {
    src: logoNeumora,
    title: 'Neumora Therapeutics',
  },
  {
    src: logoResilience,
    title: 'Resilience',
    width: '240px',
  },
  {
    src: logoInari,
    title: 'Inari',
  },
  {
    src: logoHudl,
    title: 'hudl',
  },
  {
    src: logoTessera,
    title: 'Tessera',
  },
  {
    src: logoDspconcepts,
    title: 'DSP Concepts',
  },
]

const useStyles = M.makeStyles({
  root: {
    padding: '0 0 70px',
  },
})

interface PartnersProps {
  className?: string
}

export default function Partners({ className }: PartnersProps) {
  const classes = useStyles()
  return (
    <LogosCarousel
      className={cx(classes.root, className)}
      logos={logos}
      title="Life Sciences Organizations Run on Quilt"
    />
  )
}
