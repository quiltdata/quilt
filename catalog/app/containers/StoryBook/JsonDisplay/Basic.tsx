import * as React from 'react'

import JsonDisplay from 'components/JsonDisplay'

const value = {
  c: {
    foobar: {
      a: 123,
      b: [345],
    },
  },
  objectA: { propertyA: true, propertyB: false },
}
export default function JsonDisplayBasic() {
  return <JsonDisplay value={value} />
}
