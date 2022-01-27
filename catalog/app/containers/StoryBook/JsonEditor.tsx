import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import * as jsonSchema from 'utils/json-schema'
import { JsonValue, ValidationErrors } from 'components/JsonEditor/constants'

const schema = {
  type: 'object',
  properties: {
    // a: { type: 'number' },
    // b: { type: 'number' },
    // c: { type: 'string', enum: ['AAAAA', 'BBBBB', 'CCCCC'] },
  },
}
const validate = jsonSchema.makeSchemaValidator(schema)

export default function JsonEditorBook() {
  const [value, setValue] = React.useState<JsonValue>({
    // a: 'A',
    // object: {
    //   propertyA: 'AAA',
    //   propertyObject: {
    //     propAA: 'AAAA111',
    //     propBB: 'BBBB222',
    //   },
    //   propertyB: 'BBB',
    // },
    // b: 'B',
    // c: 'C',
    // d: 'D',
    // e: 'E',
    // f: 'F',
    // g: 'G',
    // h: 'H',
    // i: 'I',
    // j: 'J',
    // k: 'K',
    // l: 'L',
    // m: 'M',
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
