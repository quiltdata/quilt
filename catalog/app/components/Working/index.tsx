/* Authentication progress */
import * as React from 'react'
import { styled } from '@material-ui/core/styles'

import Spinner from 'components/Spinner'

const Faint = styled('h1')({
  fontWeight: 'lighter',
  opacity: 0.6,
})

interface WorkingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode
}

const Working = ({ children = ' ', ...props }: WorkingProps) => (
  <Faint {...props}>
    <Spinner />
    {children}
  </Faint>
)

export default Working
