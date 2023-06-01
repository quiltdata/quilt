import * as React from 'react'

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

interface Success {
  name: string
  hash: string
}

interface MainState {
  disabled: boolean
  errors: Error[] | null
  submitted: boolean
  submitting: boolean
  success: Success | null
  // TODO: Error[] | L | Success
}

export interface MainContext {
  state: MainState
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
  const disabled = useDisabled(ctx)
  const [errors, setErrors] = React.useState<Error[] | null>(null)
  const getFormData = useFormData(ctx)
  const createPackage = useCreatePackage()
  const [submitted, setSubmitted] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [success, setSuccess] = React.useState<Success | null>(null)
  const onSubmit = React.useCallback(async () => {
    setSubmitted(true)
    if (disabled) return
    setSubmitting(true)
    try {
      const formData = await getFormData()
      const r = await createPackage(formData)
      switch (r.__typename) {
        case 'PackagePushSuccess':
          setSuccess({ name: formData.params.name, hash: r.revision.hash })
          break
        case 'OperationError':
          setErrors([new Error(r.message)])
          break
        case 'InvalidInput':
          setErrors(r.errors.map(({ message }) => new Error(message)))
          break
        default:
          assertNever(r)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
    setSubmitting(false)
  }, [createPackage, disabled, getFormData])

  const state = React.useMemo(
    () => ({
      disabled: submitted && disabled,
      errors,
      submitted,
      submitting,
      success,
    }),
    [submitting, errors, disabled, submitted, success],
  )

  return React.useMemo(
    () => ({
      state,
      actions: {
        onSubmit,
      },
    }),
    [state, onSubmit],
  )
}
