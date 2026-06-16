import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Header from './Header'
import Images from './Images'
import QuratorInline from './QuratorInline'
import Summaries from './Summaries'
import TabulatorTables from './TabulatorTables'

export default function Overview() {
  const { bucket } = useParams<{ bucket: string }>()
  return (
    <M.Box pb={{ xs: 0, sm: 4 }} mx={{ xs: -2, sm: 0 }} position="relative" zIndex={1}>
      <Header bucket={bucket} />
      <QuratorInline />
      <TabulatorTables bucket={bucket} />
      <Images bucket={bucket} />
      <Summaries bucket={bucket} />
    </M.Box>
  )
}
