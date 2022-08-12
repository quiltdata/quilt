import * as React from 'react'

import type { S3HandleBase } from 'utils/s3paths'

export interface S3SummarizeHandle extends S3HandleBase {
  logicalKey?: string
  size?: number
}

export interface LogicalKeyResolver {
  (logicalKey: string): S3SummarizeHandle | Promise<S3SummarizeHandle>
}

const Ctx = React.createContext<LogicalKeyResolver | null>(null)

export function useLogicalKeyResolver() {
  return React.useContext(Ctx)
}

export const use = useLogicalKeyResolver

export const { Provider } = Ctx
