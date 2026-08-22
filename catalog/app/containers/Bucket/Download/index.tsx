// TODO: move to Bucket/Toolbar/Get/index.tsx

import * as React from 'react'
import * as Icons from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

export { default as PackageOptions } from './PackageOptions'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export const Button = ({ label = 'Get files', ...props }: ButtonProps) => (
  <Buttons.WithPopover icon={Icons.GetAppOutlined} label={label} {...props} />
)
