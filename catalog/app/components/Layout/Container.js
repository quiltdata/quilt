import * as React from 'react'
import { unstable_Box as Box } from '@material-ui/core/Box'
import { useTheme } from '@material-ui/styles'

export default (props) => {
  const t = useTheme()
  return (
    <Box
      maxWidth={t.layout.container.width + t.spacing.unit * 4}
      px={2}
      mx="auto"
      width="100%"
      {...props}
    />
  )
}
