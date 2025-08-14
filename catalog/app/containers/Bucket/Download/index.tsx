import * as React from 'react'
import { GetAppOutlined as IconGetAppOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

export { default as PackageOptions } from './PackageOptions'
export { default as BucketOptions } from './BucketOptions'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export const Button = ({ label = 'Get files', ...props }: ButtonProps) => (
  <Buttons.WithPopover icon={IconGetAppOutlined} label={label} {...props} />
)
