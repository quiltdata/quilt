import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Header from './Header'
import QuratorInline from './QuratorInline'
import TabulatorTables from './TabulatorTables'

export default function Overview() {
  const { bucket } = useParams<{ bucket: string }>()
  return (
    <M.Box pb={{ xs: 0, sm: 4 }} mx={{ xs: -2, sm: 0 }} position="relative" zIndex={1}>
      <Header bucket={bucket} />
      <QuratorInline />
      <TabulatorTables bucket={bucket} />
    </M.Box>
  )
}
