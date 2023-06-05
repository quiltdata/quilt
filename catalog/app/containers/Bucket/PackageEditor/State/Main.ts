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
  disabled: boolean
  status: Error[] | typeof L | Success | null
  submitted: boolean
}

export interface MainContext {
  state: MainState
  getters: {
    success: () => Success | null
  }
  actions: {
    onSubmit: () => void
  }
}

interface Everything {
  bucket: BucketContext
  files: FilesContext
  message: MessageContext
  meta: MetaContext
  name: NameContext
  workflow: WorkflowContext
}

function useDisabled(ctx: Everything) {
  return React.useMemo(
    () =>
      ctx.bucket.getters.disabled() ||
      ctx.files.getters.disabled() ||
      ctx.message.getters.disabled() ||
      ctx.meta.getters.disabled() ||
      ctx.name.getters.disabled() ||
      ctx.workflow.getters.disabled(),
    [ctx],
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

function useFormData(ctx: Everything): () => Promise<FormData> {
  return React.useCallback(async () => {
    const bucket = ctx.bucket.getters.formData()
    const message = ctx.message.getters.formData()
    const name = ctx.name.getters.formData()
    const userMeta = ctx.meta.getters.formData()
    const workflow = ctx.workflow.getters.formData()

    const entries = await ctx.files.getters.formData(bucket, name)

    return { params: { name, message, bucket, workflow, userMeta }, src: { entries } }
  }, [ctx])
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

export default function useMain(ctx: Everything): MainContext {
  const [status, setStatus] = React.useState<Error[] | typeof L | Success | null>(null)
  const [submitted, setSubmitted] = React.useState(false)

  const disabled = useDisabled(ctx)
  const getFormData = useFormData(ctx)
  const createPackage = useCreatePackage()

  const onSubmit = React.useCallback(async () => {
    setSubmitted(true)
    if (disabled) return
    setStatus(L)
    try {
      const formData = await getFormData()
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
  }, [createPackage, disabled, getFormData])

  const state: MainState = React.useMemo(
    () => ({
      disabled: submitted && disabled,
      submitted,
      status,
    }),
    [disabled, submitted, status],
  )

  return React.useMemo(
    () => ({
      state,
      getters: {
        success: () => getSuccess(state),
      },
      actions: {
        onSubmit,
      },
    }),
    [state, onSubmit],
  )
}
