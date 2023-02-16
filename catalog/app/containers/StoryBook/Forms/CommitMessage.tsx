import * as React from 'react'
import * as M from '@material-ui/core'
import type * as RF from 'react-final-form'

import { CommitMessageInput } from 'containers/Bucket/PackageDialog/PackageDialog'

const errors = {
  foo: 'Has error',
}

export default function ButtonsIconized() {
  const [value, setValue] = React.useState('')
  const input = React.useMemo(
    () =>
      ({
        value,
        onChange: (e) => setValue(e.target.value),
      } as RF.FieldInputProps<string>),
    [value],
  )
  return (
    <M.Container maxWidth="sm">
      <CommitMessageInput errors={errors} input={input} meta={{}} helperText="Basic" />
      <CommitMessageInput
        errors={errors}
        input={input}
        meta={{ error: 'foo' }}
        helperText="Has error, but error is not shown"
      />
      <CommitMessageInput
        errors={errors}
        input={input}
        meta={{ error: 'foo', submitFailed: true }}
      />
      <CommitMessageInput
        errors={errors}
        input={input}
        meta={{ submitting: true }}
        helperText="Disabled"
      />
      <CommitMessageInput
        errors={errors}
        input={input}
        meta={{ submitFailed: true, validating: true }}
        helperText="Validating"
      />
    </M.Container>
  )
}
