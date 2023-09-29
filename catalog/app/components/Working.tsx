/* Authentication progress */
import React from 'react'
import * as M from '@material-ui/core'

import Spinner from 'components/Spinner'

const Faint = M.styled('h1')({
  fontWeight: 'lighter',
  opacity: 0.6,
})

const Working = ({
  children = ' ',
  ...props
}: React.PropsWithChildren<React.HTMLAttributes<HTMLHeadingElement>>) => (
  <Faint {...props}>
    <Spinner />
    {children}
  </Faint>
)

export default Working
