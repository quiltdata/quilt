import * as React from 'react'
import * as M from '@material-ui/core'

import { L } from 'components/Form/Package/types'
import JsonEditor from 'components/JsonEditor'

import { useContext } from './StateProvider'

export default function Metadata() {
  const { meta } = useContext()
  if (meta.state === L) return <M.CircularProgress />
  return (
    <JsonEditor
      multiColumned
      errors={[]}
      onChange={() => {}}
      schema={meta.state.schema}
      value={meta.state.value}
    />
  )
}
