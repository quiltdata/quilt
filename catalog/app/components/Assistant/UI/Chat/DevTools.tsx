import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import Markdown from 'components/Markdown'
import usePrevious from 'utils/usePrevious'

import * as Model from '../../Model'

interface DevToolsProps {
  state: Model.Assistant.API['state']
  dispatch: Model.Assistant.API['dispatch']
  onToggle: () => void
}

export default function DevTools({ state, dispatch, onToggle }: DevToolsProps) {
  return (
    <>
      <JsonDisplay name="State" value={state} defaultExpanded={1} />
      <M.Button onClick={onToggle}>Close</M.Button>
    </>
  )
}
