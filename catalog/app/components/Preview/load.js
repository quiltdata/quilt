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
import * as fallback from './loaders/fallback'

const loaderChain = [
  Csv,
  Excel,
  Fcs,
  Echarts,
  Json,
  Markdown,
  Notebook,
  Parquet,
  Pdf,
  Vcf,
  Html,
  Text,
  Image,
  fallback,
]

export function Load({ handle, children, options }) {
  const key = handle.logicalKey || handle.key
  const { Loader } = React.useMemo(
    () =>
      loaderChain.find((L) => (L === Echarts ? L.detect(key, options) : L.detect(key))),
    [key, options],
  )
  return <Loader {...{ handle, children }} />
}

export default (handle, children, options) => <Load {...{ handle, children, options }} />
