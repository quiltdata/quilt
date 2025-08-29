import * as React from 'react'

export { default as PackageOptions } from './PackageOptions'

// Simple placeholder components to maintain compatibility
export const Button: React.FC<{
  children: React.ReactNode
  className?: string
  label?: string
}> = ({ children, className, label }) =>
  React.createElement('div', { className, title: label }, children)

export const BucketOptions: React.FC<{ handle: unknown; hideCode?: boolean }> = () =>
  React.createElement('div', null, 'Download options not implemented')
