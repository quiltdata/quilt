/* Authentication progress */
import PropTypes from 'prop-types'
import React from 'react'
import { FormattedMessage } from 'react-intl'
import { styled } from '@material-ui/styles'

import Spinner from 'components/Spinner'

import messages from './messages'

const Faint = styled('h1')({
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
  children: <FormattedMessage {...messages.header} />,
}

export default Working
