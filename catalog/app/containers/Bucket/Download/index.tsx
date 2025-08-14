import * as React from 'react'
import * as Buttons from 'components/Buttons'

export { default as PackageOptions } from './PackageOptions'
export { default as BucketOptions } from './BucketOptions'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export const Button = ({ label = 'Get files', ...props }: ButtonProps) => (
  <Buttons.WithPopover icon="download" label={label} {...props} />
)
