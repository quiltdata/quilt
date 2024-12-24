import * as React from 'react'

import Slides from 'website/components/Slides'

import slide1 from './chloropleth.png'
import slide2 from './overview.png'
import slide3 from './genomes-images.png'
import slide4 from './terrain-tiles.png'
import slide5 from './versions.png'
import slide6 from './packages.png'

const slides = [
  {
    src: slide1,
    caption: 'Choose from more than 25 visualizations',
  },
  {
    src: slide2,
    caption: 'Summarize S3 buckets',
  },
  {
    src: slide5,
    caption: 'Version every file',
  },
  {
    src: slide6,
    caption: 'Create versioned data sets from buckets or folders',
  },
  {
    src: slide3,
    caption: 'Preview bucket contents',
  },
  {
    src: slide4,
    caption: 'Browse image collections',
  },
]

export default function Screenshots(props: Omit<Parameters<typeof Slides>[0], 'slides'>) {
  return <Slides slides={slides} {...props} />
}
