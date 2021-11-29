import * as React from 'react'

import LogosCarousel from 'website/pages/Landing/LogosCarousel'

import logoAics from './logo-aics.png'
import logoCelsius from './logo-celsius.png'
import logoHudl from './logo-hudl.png'
import logoRibon from './logo-ribon.png'
import logoSight from './logo-sight.png'
import logoAI2 from './logo-ai2.png'
import logoNetguru from './logo-netguru.png'
import logoBT from './logo-bt.png'
import logoZee5 from './logo-zee5.png'

const logos = [
  {
    src: logoAics,
    title: 'Allen Institute for Cell Science',
  },
  {
    src: logoBT,
    title: 'BlackThorn Therapeutics',
  },
  {
    src: logoHudl,
    title: 'hudl',
  },
  {
    src: logoAI2,
    title: 'Allen Institute for AI',
  },
  {
    src: logoCelsius,
    title: 'Celsius',
  },
  {
    src: logoRibon,
    title: 'Ribon Therapeutics',
  },
  {
    src: logoSight,
    title: 'Sighthound',
  },
  {
    src: logoNetguru,
    title: 'Netguru',
  },
  {
    src: logoZee5,
    title: 'Zee5',
  },
]

export default function Logos() {
  return <LogosCarousel logos={logos} />
}
