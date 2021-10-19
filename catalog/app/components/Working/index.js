/* Authentication progress */
import PropTypes from 'prop-types'
import React from 'react'
import { styled } from '@material-ui/styles'

import Spinner from 'components/Spinner'

const Faint = styled('h1')({
  fontWeight: 'lighter',
  opacity: 0.6,
})

const Working = ({ children, ...props }) => (
  <Faint {...props}>
    <Spinner />
    {children}
  </Faint>
)

Working.propTypes = {
  children: PropTypes.node,
}

Working.defaultProps = {
  children: ' ',
}

export default Working
