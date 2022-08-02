import * as React from 'react'

import type { S3Handle } from 'utils/s3paths'

export interface LogicalKeyResolver {
  (logicalKey: string): S3Handle | Promise<S3Handle>
}

const Ctx = React.createContext<LogicalKeyResolver | null>(null)

export function useLogicalKeyResolver() {
  return React.useContext(Ctx)
}

export const use = useLogicalKeyResolver

export const { Provider } = Ctx
