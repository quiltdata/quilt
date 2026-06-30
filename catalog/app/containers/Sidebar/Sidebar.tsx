import * as React from 'react'

import { RailA } from './RailA'
import { RailB } from './RailB'

// Two side-by-side rails beneath the full-width header: Rail A (app chrome —
// workspaces, links, account) then Rail B (locations — bookmarks, buckets).
export function Sidebar() {
  return (
    <>
      <RailA />
      <RailB />
    </>
  )
}
