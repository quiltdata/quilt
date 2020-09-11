import * as React from 'react'

import * as Csv from './loaders/Csv'
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

export function Load({ handle, children }) {
  const key = handle.logicalKey || handle.key
  const { Loader } = React.useMemo(() => loaderChain.find((L) => L.detect(key)), [key])
  return <Loader {...{ handle, children }} />
}

export default (handle, children) => <Load {...{ handle, children }} />
