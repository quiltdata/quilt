import * as React from 'react'
import { styled } from '@material-ui/styles'

const IFrame = styled((props) => (
  <iframe title="Preview" sandbox="allow-scripts" {...props} />
))({
  border: 'none',
  height: '90vh',
  width: '100%',
})

export default (ifr, props) => <IFrame {...ifr} {...props} />
