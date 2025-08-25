import * as React from 'react'

import { GetAppOutlined as IconGetAppOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export default function Button({ label = 'Get files', ...props }: ButtonProps) {
  return <Buttons.WithPopover icon={IconGetAppOutlined} label={label} {...props} />
}
