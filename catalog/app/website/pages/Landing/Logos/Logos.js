import * as React from 'react'

import LogosCarousel from 'website/pages/Landing/LogosCarousel'

import logoCelsius from './logo-celsius.png'
import logoHudl from './logo-hudl.png'
import logoNeumora from './logo-neumora.png'
import logoObsidian from './logo-obsidian.png'
import logoSight from './logo-sight.png'
import logoStemson from './logo-stemson.png'
import logoVir from './logo-vir.png'

const logos = [
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
    src: logoHudl,
    title: 'hudl',
  },
  {
    src: logoSight,
    title: 'Sighthound',
  },
]

export default function Logos() {
  return <LogosCarousel logos={logos} title="Companies that love Quilt" />
}
