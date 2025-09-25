import * as React from 'react'
import * as M from '@material-ui/core'

import type { FormStatus } from '../State/form'
import type { SchemaStatus } from '../State/schema'
import type { MetaState } from '../State/meta'
import { MetaInput } from '../MetaInput'
import { MetaInputSkeleton } from '../Skeleton'

const useInputMetaStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

interface InputMetaProps {
  formStatus: FormStatus
  schema: SchemaStatus
  state: MetaState
}

const InputMeta = React.forwardRef<HTMLDivElement, InputMetaProps>(function InputMeta(
  { formStatus, schema, state: { status, value, onChange } },
  ref,
) {
  const classes = useInputMetaStyles()
  const errors = React.useMemo(() => {
    if (schema._tag === 'error') return [schema.error]
    if (status._tag === 'error') return status.errors
    return []
  }, [schema, status])
  if (schema._tag === 'loading') {
    return <MetaInputSkeleton ref={ref} className={classes.root} />
  }
  return (
    <MetaInput
      disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
      className={classes.root}
      errors={errors}
      onChange={onChange}
      ref={ref}
      schema={schema._tag === 'ready' ? schema.schema : undefined}
      value={value}
    />
  )
})

export default InputMeta
