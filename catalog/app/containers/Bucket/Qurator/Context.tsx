import * as React from 'react'

import * as Assistant from 'components/Assistant'
import type * as Model from 'model'

interface QuratorContextProps {
  handle: Model.S3.S3ObjectLocation
}

export default function QuratorContext({ handle }: QuratorContextProps) {
  const messages = [
    `You are viewing the details page for an S3 object ${JSON.stringify(handle)}`,
  ]
  return <Assistant.Context.Push messages={messages} tools={{}} />
}
