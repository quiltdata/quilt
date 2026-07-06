import * as React from 'react'

interface HljsBoundaryProps {
  children: React.ReactNode
  fallback: React.ReactNode
}

export default function HljsBoundary({ children, fallback }: HljsBoundaryProps) {
  return <React.Suspense fallback={fallback ?? null}>{children}</React.Suspense>
}
