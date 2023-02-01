import * as React from 'react'

import JsonEditor from 'components/JsonEditor'

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

const noop = () => {}

export default function JsonEditorBasic() {
  return (
    <JsonEditor errors={[]} multiColumned onChange={noop} schema={schema} value={null} />
  )
}
