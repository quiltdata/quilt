import * as React from 'react'

interface HljsBoundaryProps {
  children: React.ReactNode
  fallback: React.ReactElement | null
}

export default function HljsBoundary({ children, fallback }: HljsBoundaryProps) {
  return <React.Suspense fallback={fallback}>{children}</React.Suspense>
}
