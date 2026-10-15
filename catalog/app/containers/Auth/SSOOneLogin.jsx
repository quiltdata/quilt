import * as React from 'react'

import SSOButton from './SSOButton'
import oneLoginLogo from './onelogin-logo.svg'

export default function SSOOneLogin(props) {
  return (
    <SSOButton
      provider="onelogin"
      name="OneLogin"
      logo={oneLoginLogo}
      popupParams="width=300,height=400"
      {...props}
    />
  )
}
