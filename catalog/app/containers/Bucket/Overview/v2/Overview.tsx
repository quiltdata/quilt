import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Header from './Header'
import Images from './Images'
import QuratorInline from './QuratorInline'
import Summaries from './Summaries'
import TabulatorTables from './TabulatorTables'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    // `minmax(0, 1fr)` keeps the single column bounded to the available width so a
    // wide child (e.g. an expanded Tabulator preview table) scrolls within its own
    // overflow container instead of stretching the column and overflowing the page.
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: t.spacing(2),
    padding: t.spacing(2, 0),
  },
}))

export default function Overview() {
  const classes = useStyles()
  const { bucket } = useParams<{ bucket: string }>()
  return (
    <div className={classes.root}>
      <Header bucket={bucket} />
      <QuratorInline />
      <TabulatorTables bucket={bucket} />
      <Images bucket={bucket} />
      <Summaries bucket={bucket} />
    </div>
  )
}
