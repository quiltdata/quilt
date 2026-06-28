import * as R from 'ramda'
import * as React from 'react'

import * as Audio from './loaders/Audio'
import * as ECharts from './loaders/ECharts'
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

// The individual loader modules each export a heterogeneous set of props/handle
// types, so the dispatcher treats them through a common, intentionally loose shape.
interface LoaderModule {
  FILE_TYPE?: $TSFixMe
  detect: (key: string, options?: $TSFixMe) => $TSFixMe
  // loaders are render-prop components returning ReactNode (not just
  // ReactElement|null), so the dispatcher holds them loosely
  Loader: $TSFixMe
}

const loaderChain: LoaderModule[] = [
  Audio,
  ECharts,
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

// `options` contains:
//   * quilt_summarize.json types
//   * `context` - where file was rendered
//   * `mode` - user set fileType
function findLoader(key: string, options?: $TSFixMe): LoaderModule {
  if (options?.mode) {
    // Detect by user selected mode
    const found = loaderChain.find(
      ({ FILE_TYPE }) => FILE_TYPE && options?.mode === FILE_TYPE,
    )
    if (found) return found
  }
  if (options?.types) {
    // Detect by quilt_summarize.json type
    const found = loaderChain.find(
      ({ FILE_TYPE }) => FILE_TYPE && summarize.detect(FILE_TYPE, options),
    )
    if (found) return found
  }
  // Detect by extension
  return loaderChain.find(({ detect }) => detect(key, options)) as LoaderModule
}

export function getRenderProps(key: string, options?: $TSFixMe) {
  const { FILE_TYPE } = findLoader(key, options)
  const optionsSpecificToType = summarize.detect(FILE_TYPE as $TSFixMe, options)
  return optionsSpecificToType && R.type(optionsSpecificToType) === 'Object'
    ? R.dissoc('name', optionsSpecificToType as $TSFixMe)
    : null
}

interface LoadProps {
  handle: $TSFixMe
  children: $TSFixMe
  options?: $TSFixMe
}

export function Load({ handle, children, options }: LoadProps) {
  // TODO: try if loader is `gated` here to avoid code repeatance
  const key = handle.logicalKey || handle.key
  const { Loader } = React.useMemo(() => findLoader(key, options), [key, options])
  return <Loader {...{ handle, children, options }} />
}

export default (handle: $TSFixMe, children: $TSFixMe, options?: $TSFixMe) => (
  <Load {...{ handle, children, options }} />
)
