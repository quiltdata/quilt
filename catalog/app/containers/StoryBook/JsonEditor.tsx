import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import * as jsonSchema from 'utils/json-schema'
import { JsonValue, ValidationErrors } from 'components/JsonEditor/constants'

const schema = {
  type: 'object',
  properties: {
    a: { type: 'number' },
    b: { type: 'number' },
  },
}
const validate = jsonSchema.makeSchemaValidator(schema)

export default function JsonEditorBook() {
  const [value, setValue] = React.useState<JsonValue>({
    a: '123',
    b: 123,
  })
  const [errors, setErrors] = React.useState<ValidationErrors>(() => validate(value))
  const onChange = React.useCallback((json) => {
    setErrors(validate(json))
    setValue(json)
  }, [])
  return (
    <M.Container maxWidth="lg">
      <M.Box bgcolor="common.white" py={2}>
        <JsonEditor
          multiColumned
          errors={errors}
          value={value}
          onChange={onChange}
          schema={schema}
        />
      </M.Box>
    </M.Container>
  )
}
