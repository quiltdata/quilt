import * as React from 'react'

import JsonDisplay from 'components/JsonDisplay'

export default ({ rendered }, props) => (
  <JsonDisplay defaultExpanded={1} value={rendered} {...props} />
)
