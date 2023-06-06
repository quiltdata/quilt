import * as React from 'react'

import L from 'constants/loading'
import { useMutation } from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import type * as Types from 'utils/types'

import PACKAGE_CONSTRUCT from '../../PackageDialog/gql/PackageConstruct.generated'

import type { BucketContext } from './Bucket'
import type { FilesContext } from './Files'
import type { MessageContext } from './Message'
import type { MetaContext } from './Meta'
import type { NameContext } from './Name'
import type { WorkflowContext } from './Workflow'

export interface Success {
  name: string
  hash: string
}

interface MainState {
  status: Error[] | typeof L | Success | null
  submitted: boolean
}

export interface MainContext {
  state: MainState
  getters: {
    success: () => Success | null
    disabled: () => boolean
  }
  actions: {
    onSubmit: () => void
  }
}

interface FormFields {
  bucket: BucketContext
  files: FilesContext
  message: MessageContext
  meta: MetaContext
  name: NameContext
  workflow: WorkflowContext
}

function isDisabled(fields: FormFields) {
  return (
    fields.bucket.getters.disabled() ||
    fields.files.getters.disabled() ||
    fields.message.getters.disabled() ||
    fields.meta.getters.disabled() ||
    fields.name.getters.disabled() ||
    fields.workflow.getters.disabled()
  )
}

// TODO: move to ../io/package
interface FormData {
  params: {
    bucket: string
    message: string
    userMeta: Types.JsonRecord | null
    name: string
    workflow: string | null
  }
  src: {
    entries: $TSFixMe
  }
}

async function getFormData(fields: FormFields): Promise<FormData> {
  const bucket = fields.bucket.getters.formData()
  const message = fields.message.getters.formData()
  const name = fields.name.getters.formData()
  const userMeta = fields.meta.getters.formData()
  const workflow = fields.workflow.getters.formData()

  const entries = await fields.files.getters.formData(bucket, name)

  return { params: { name, message, bucket, workflow, userMeta }, src: { entries } }
}

function getSuccess(state: MainState): Success | null {
  if (!state.status || state.status === L || Array.isArray(state.status)) return null
  return state.status
}

// TODO: move to ../io/package
function useCreatePackage() {
  const constructPackage = useMutation(PACKAGE_CONSTRUCT)
  return React.useCallback(
    async (formData: FormData) => {
      const { packageConstruct } = await constructPackage(formData)
      return packageConstruct
    },
    [constructPackage],
  )
}

export default function useMain(fields: FormFields): MainContext {
  const [status, setStatus] = React.useState<Error[] | typeof L | Success | null>(null)
  const [submitted, setSubmitted] = React.useState(false)

  const createPackage = useCreatePackage()

  const onSubmit = React.useCallback(async () => {
    setSubmitted(true)
    const disabled = isDisabled(fields)
    if (disabled) return
    setStatus(L)
    try {
      const formData = await getFormData(fields)
      const r = await createPackage(formData)
      switch (r.__typename) {
        case 'PackagePushSuccess':
          setStatus({ name: formData.params.name, hash: r.revision.hash })
          break
        case 'OperationError':
          setStatus([new Error(r.message)])
          break
        case 'InvalidInput':
          setStatus(r.errors.map(({ message }) => new Error(message)))
          break
        default:
          setStatus([new Error((r as unknown as any).__typename)])
          assertNever(r)
      }
    } catch (error) {
      setStatus([error as unknown as Error])
    }
  }, [createPackage, fields])

  const state: MainState = React.useMemo(
    () => ({
      submitted,
      status,
    }),
    [submitted, status],
  )

  return React.useMemo(
    () => ({
      state,
      getters: {
        disabled: () => state.submitted && isDisabled(fields),
        success: () => getSuccess(state),
      },
      actions: {
        onSubmit,
      },
    }),
    [state, fields, onSubmit],
  )
}
