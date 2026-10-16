import * as React from 'react'

import SSOButton from './SSOButton'
import oktaLogo from './okta-logo.svg'

export default function SSOOkta(props) {
  return (
    <SSOButton
      provider="okta"
      name="Okta"
      logo={oktaLogo}
      popupParams="width=400,height=600"
      {...props}
    />
  )
}
