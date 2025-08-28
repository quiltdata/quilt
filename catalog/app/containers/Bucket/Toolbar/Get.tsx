import * as React from 'react'

import { GetAppOutlined as IconGetAppOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'

type ButtonProps = Omit<Buttons.WithPopoverProps, 'icon'>

export default function Button({ label = 'Get files', ...props }: ButtonProps) {
  return <Buttons.WithPopover icon={IconGetAppOutlined} label={label} {...props} />
}
