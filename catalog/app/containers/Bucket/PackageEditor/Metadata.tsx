import * as React from 'react'
import * as M from '@material-ui/core'

import { L } from 'components/Form/Package/types'
import JsonEditor from 'components/JsonEditor'

import { useContext } from './State/Provider'

export default function Metadata() {
  const { meta } = useContext()
  if (meta.state === L) return <M.CircularProgress />
  return (
    <JsonEditor
      errors={[]}
      multiColumned
      onChange={() => {}}
      schema={meta.state.schema}
      value={meta.state.value}
    />
  )
}
