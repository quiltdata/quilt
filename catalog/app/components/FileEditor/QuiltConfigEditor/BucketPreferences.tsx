import * as React from 'react'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import type { JsonSchema } from 'utils/json-schema'

interface BucketPreferencesProps {
  children: (props: { schema: JsonSchema }) => React.ReactElement
}

export default function BucketPreferences({ children }: BucketPreferencesProps) {
  return children({ schema: bucketPreferencesSchema })
}
