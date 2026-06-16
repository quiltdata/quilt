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
