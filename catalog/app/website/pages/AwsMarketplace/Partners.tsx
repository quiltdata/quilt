import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import LogosCarousel from 'website/pages/Landing/LogosCarousel'

import logoAllencell from 'website/pages/Landing/Logos/logo-allencell.png'
import logoCelsius from 'website/pages/Landing/Logos/logo-celsius.png'
import logoNeumora from 'website/pages/Landing/Logos/logo-neumora.png'
import logoObsidian from 'website/pages/Landing/Logos/logo-obsidian.png'
import logoStemson from 'website/pages/Landing/Logos/logo-stemson.png'
import logoVir from 'website/pages/Landing/Logos/logo-vir.png'

import logoTessera from './logo-tessera.png'
import logoResilience from './logo-resilience.svg'
import logoDspconcepts from './logo-dspconcepts.svg'

const logos = [
  {
    src: logoTessera,
    title: 'Tessera',
    // width: '240px',
  },
  {
    src: logoResilience,
    title: 'Resilience',
    width: '240px',
  },
  {
    src: logoDspconcepts,
    title: 'DSP Concepts',
  },
  {
    src: logoCelsius,
    title: 'Celsius Therapeutics',
  },
  {
    src: logoVir,
    title: 'Vir Bio',
  },
  {
    src: logoNeumora,
    title: 'Neumora Therapeutics',
  },
  {
    src: logoObsidian,
    title: 'Obsidian Therapeutics',
  },
  {
    src: logoStemson,
    title: 'Stemson Therapeutics',
  },
  {
    src: logoAllencell,
    title: 'Allen Institute for Cell Science',
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
