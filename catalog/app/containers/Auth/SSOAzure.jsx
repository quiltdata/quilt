import * as React from 'react'

import SSOButton from './SSOButton'
import microsoftLogo from './microsoft-logo.svg'

export default function SSOAzure(props) {
  return (
    <SSOButton
      provider="azure"
      name="Microsoft"
      logo={microsoftLogo}
      popupParams="width=500,height=700"
      {...props}
    />
  )
}
