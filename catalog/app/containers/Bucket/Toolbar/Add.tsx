import * as React from 'react'

import { AddOutlined as IconAddOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export default function Button({ children, label = 'Add files', ...props }: ButtonProps) {
  return (
    <Buttons.WithPopover icon={IconAddOutlined} label={label} {...props}>
      {children}
    </Buttons.WithPopover>
  )
}
