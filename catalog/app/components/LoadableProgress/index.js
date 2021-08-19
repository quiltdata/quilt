import React from 'react'

import Working from 'components/Working'

// error: any, pastDelay: boolean
export default function LoadableProgress({ error, pastDelay }) {
  if (error) {
    return <div>Error loading component!</div>
  }
  if (pastDelay) {
    return <Working />
  }
  return null
}
