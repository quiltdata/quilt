import * as React from 'react'

import * as Buttons from 'components/Buttons'

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  label?: string
}

export default function Button({ label = 'Get files', ...props }: ButtonProps) {
  return <Buttons.WithPopover icon="download" label={label} {...props} />
}
