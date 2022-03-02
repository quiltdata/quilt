import * as React from 'react'

import * as Audio from './loaders/Audio'
import * as Echarts from './loaders/Echarts'
import * as Fcs from './loaders/Fcs'
import * as Html from './loaders/Html'
import * as Image from './loaders/Image'
import * as Json from './loaders/Json'
import * as Markdown from './loaders/Markdown'
import * as Ngl from './loaders/Ngl'
import * as Notebook from './loaders/Notebook'
import * as Pdf from './loaders/Pdf'
import * as Tabular from './loaders/Tabular'
import * as Text from './loaders/Text'
import * as Vcf from './loaders/Vcf'
import * as Video from './loaders/Video'
import * as Voila from './loaders/Voila'
import * as fallback from './loaders/fallback'

const loaderChain = [
  Fcs,
  Echarts, // should be before Json, or TODO: add "type is not 'echarts'" to Json.detect
  Json,
  Markdown,
  Ngl,
  Voila, // should be before Notebook, or TODO: add "type is not 'voila'" to Notebook.detect
  Notebook,
  Pdf,
  Vcf,
  Html,
  Image,
  Video,
  Audio,
  Tabular,
  Text,
  fallback,
]

function findLoader(key, options) {
  return loaderChain.find(({ detect }) => detect(key, options))
}

export function getRenderProps(key, options) {
  const { detect } = findLoader(key, options)
  const optionsSpecificToType = detect(key, options)
  return optionsSpecificToType && optionsSpecificToType.style
    ? {
        style: optionsSpecificToType.style,
      }
    : null
}

export function Load({ handle, children, options }) {
  const key = handle.logicalKey || handle.key
  const { Loader } = React.useMemo(() => findLoader(key, options), [key, options])
  return <Loader {...{ handle, children, options }} />
}

export default (handle, children, options) => <Load {...{ handle, children, options }} />
