import * as React from 'react'

import type { JsonSchema } from 'utils/JSONSchema'

export interface ConfigDetailsProps {
  children: (props: {
    header?: React.ReactNode
    schema?: JsonSchema
  }) => React.ReactElement
}

const dummyProps = {}
export default function DummyConfigDetails({ children }: ConfigDetailsProps) {
  return children(dummyProps)
}
