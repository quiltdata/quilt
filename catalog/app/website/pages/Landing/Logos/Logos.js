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
    title: 'Celsius',
  },
  {
    src: logoVir,
    title: 'Vir',
  },
  {
    src: logoNeumora,
    title: 'Neumora',
  },
  {
    src: logoObsidian,
    title: 'Obsidian',
  },
  {
    src: logoStemson,
    title: 'Stemson',
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
  return <LogosCarousel logos={logos} />
}
