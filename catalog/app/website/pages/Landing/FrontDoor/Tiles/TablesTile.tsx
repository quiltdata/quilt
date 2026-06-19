import * as React from 'react'
import * as M from '@material-ui/core'

import TileCard from './TileCard'

export default function TablesTile() {
  return (
    <TileCard icon="table_chart" title="Tables">
      <M.Typography color="textSecondary" variant="body2">
        Tables coming soon
      </M.Typography>
    </TileCard>
  )
}
