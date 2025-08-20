import * as React from 'react'

import { GetAppOutlined as IconGetAppOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

export { default as BucketDirOptions } from './BucketDirOptions'
export { default as BucketFileOptions } from './BucketFileOptions'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export const Button = ({ label = 'Get files', ...props }: ButtonProps) => (
  <Buttons.WithPopover icon={IconGetAppOutlined} label={label} {...props} />
)
