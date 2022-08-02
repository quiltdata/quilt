import * as React from 'react'

// FIXME: re-use from summarize
interface S3SummarizeHandle {
  bucket: string
  key: string
  logicalKey?: string
  size?: number
  version?: string
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
