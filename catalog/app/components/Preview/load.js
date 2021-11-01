import * as React from 'react'

import * as Csv from './loaders/Csv'
import * as Echarts from './loaders/Echarts'
import * as Excel from './loaders/Excel'
import * as Fcs from './loaders/Fcs'
import * as Html from './loaders/Html'
import * as Image from './loaders/Image'
import * as Json from './loaders/Json'
import * as Markdown from './loaders/Markdown'
import * as Notebook from './loaders/Notebook'
import * as Parquet from './loaders/Parquet'
import * as Pdf from './loaders/Pdf'
import * as Text from './loaders/Text'
import * as Vcf from './loaders/Vcf'
import * as Voila from './loaders/Voila'
import * as fallback from './loaders/fallback'

const loaderChain = [
  Csv,
  Excel,
  Fcs,
  Echarts, // should be before Json, or TODO: add "type is not 'echarts'" to Json.detect
  Json,
  Markdown,
  Voila, // should be before Notebook, or TODO: add "type is not 'voila'" to Notebook.detect
  Notebook,
  Parquet,
  Pdf,
  Vcf,
  Html,
  Text,
  Image,
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
