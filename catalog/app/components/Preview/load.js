import * as R from 'ramda'
import * as React from 'react'

import * as Audio from './loaders/Audio'
import * as Echarts from './loaders/Echarts'
import * as Fcs from './loaders/Fcs'
import * as Html from './loaders/Html'
import * as Igv from './loaders/Igv'
import * as Image from './loaders/Image'
import * as Json from './loaders/Json'
import * as Manifest from './loaders/Manifest'
import * as Markdown from './loaders/Markdown'
import * as NamedPackage from './loaders/NamedPackage'
import * as Ngl from './loaders/Ngl'
import * as Notebook from './loaders/Notebook'
import * as Pdf from './loaders/Pdf'
import * as Tabular from './loaders/Tabular'
import * as Text from './loaders/Text'
import * as Vcf from './loaders/Vcf'
import * as Vega from './loaders/Vega'
import * as Video from './loaders/Video'
import * as Voila from './loaders/Voila'
import * as fallback from './loaders/fallback'
import * as summarize from './loaders/summarize'

const loaderChain = [
  Audio,
  Echarts,
  Fcs,
  Html,
  Igv,
  Image,
  Json,
  Manifest,
  Markdown,
  NamedPackage,
  Ngl,
  Notebook,
  Pdf,
  Tabular,
  Vcf,
  Vega,
  Video,
  Voila,
  Text,
  fallback,
]

// `options` stores:
//   * quilt_summarize.json types
//   * `context` - where files was rendered
//   * mode - user set fileType
function findLoader(key, options) {
  if (options.mode) {
    // Detect by user selected mode
    const found = loaderChain.find(
      ({ FILE_TYPE }) => FILE_TYPE && options?.mode === FILE_TYPE,
    )
    if (found) return found
  }
  if (options.types) {
    // Detect by quilt_summarize.json type
    const found = loaderChain.find(({ FILE_TYPE }) =>
      FILE_TYPE ? summarize.detect(FILE_TYPE, options) : false,
    )
    if (found) return found
  }
  // Detect by extension
  return loaderChain.find(({ detect }) => detect(key, options))
}

export function getRenderProps(key, options) {
  const { detect } = findLoader(key, options)
  const optionsSpecificToType = detect(key, options)
  return optionsSpecificToType && R.type(optionsSpecificToType) === 'Object'
    ? R.dissoc('name', optionsSpecificToType)
    : null
}

export function Load({ handle, children, options }) {
  // TODO: try if loader is `gated` here to avoid code repeatance
  const key = handle.logicalKey || handle.key
  const { Loader } = React.useMemo(() => findLoader(key, options), [key, options])
  return <Loader {...{ handle, children, options }} />
}

export default (handle, children, options) => <Load {...{ handle, children, options }} />
