import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

export default ({ rendered }: { rendered: unknown }, props: Partial<M.BoxProps>) => (
  <JsonDisplay defaultExpanded={1} value={rendered} {...props} />
)
