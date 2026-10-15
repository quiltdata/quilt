import * as React from 'react'

import SSOButton from './SSOButton'
import googleLogo from './google-logo.svg'

export default function SSOGoogle(props) {
  return (
    <SSOButton
      provider="google"
      name="Google"
      logo={googleLogo}
      popupParams="width=600,height=600"
      {...props}
    />
  )
}
