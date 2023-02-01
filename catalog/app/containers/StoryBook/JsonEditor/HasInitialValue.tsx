import * as React from 'react'

import JsonEditor from 'components/JsonEditor'
import { JsonValue, ValidationErrors } from 'components/JsonEditor/constants'
import * as jsonSchema from 'utils/json-schema'

const schema = {
  type: 'object',
  properties: {
    c: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          a: { anyOf: [{ type: 'number', minimum: 1024 }, { type: 'string' }] },
          b: {
            type: 'array',
            items: {
              type: 'number',
            },
          },
        },
      },
    },
  },
}

const validate = jsonSchema.makeSchemaValidator(schema)

export default function JsonEditorHasInitialValue() {
  const [value, setValue] = React.useState<JsonValue>({
    c: {
      foobar: {
        a: 123,
        b: [345],
      },
    },
    objectA: { propertyA: true, propertyB: false },
  })
  const [errors, setErrors] = React.useState<ValidationErrors>(() => validate(value))
  const onChange = React.useCallback((json) => {
    setErrors(validate(json))
    setValue(json)
  }, [])
  return (
    <JsonEditor
      errors={errors}
      multiColumned
      onChange={onChange}
      schema={schema}
      value={value}
    />
  )
}
