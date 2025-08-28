import * as React from 'react'

import { AddOutlined as IconAddOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

type ButtonProps = Omit<Buttons.WithPopoverProps, 'icon'>

export default function Button({ label = 'Add files', ...props }: ButtonProps) {
  return <Buttons.WithPopover icon={IconAddOutlined} label={label} {...props} />
}
