import { basename } from 'path'

import * as React from 'react'
import * as redux from 'react-redux'

import * as authSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import * as GQL from 'utils/GraphQL'
import { NameTemplates, execTemplate } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import * as Request from 'utils/useRequest'
import * as workflows from 'utils/workflows'

import PACKAGE_EXISTS_QUERY from '../gql/PackageExists.generated'

import type { FormStatus } from './form'

function getUsernamePrefix(username?: string | null) {
  if (!username) return ''
  const name = username.includes('@') ? username.split('@')[0] : username
  // see PACKAGE_NAME_FORMAT at quilt3/util.py
  const validParts = name.match(/\w+/g)
  return validParts ? `${validParts.join('')}/` : ''
}

const getDefaultPackageName = (
  workflow: { packageName: NameTemplates },
  { directory, username }: { directory?: string; username: string },
) => {
  const usernamePrefix = getUsernamePrefix(username)
  const templateBasedName =
    typeof directory === 'string'
      ? execTemplate(workflow?.packageName, 'files', {
          directory: basename(directory),
          username: s3paths.ensureNoSlash(usernamePrefix),
        })
      : execTemplate(workflow?.packageName, 'packages', {
          username: s3paths.ensureNoSlash(usernamePrefix),
        })
  return typeof templateBasedName === 'string' ? templateBasedName : usernamePrefix
}

export type NameValidationStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok' }

interface PackageSrc {
  bucket: string
  name: string
  hash?: string
}

interface PackageDst {
  bucket: string
  name?: string
}

export type NameStatus =
  | { _tag: 'new-revision' }
  | { _tag: 'exists'; dst: Required<PackageDst> }
  | { _tag: 'new' }
  | Exclude<NameValidationStatus, { _tag: 'ok' }>

export interface NameState {
  value: string | undefined
  status: NameStatus
  onChange: (n: string) => void
}

function useNameExistence(dst: PackageDst, src?: PackageSrc): NameStatus {
  const pause =
    !dst.bucket || !dst.name || (dst.bucket === src?.bucket && dst.name === src.name)
  const packageExistsQuery = GQL.useQuery(
    PACKAGE_EXISTS_QUERY,
    dst as Required<PackageDst>,
    { pause },
  )
  return React.useMemo(() => {
    if (!dst.bucket || !dst.name) return { _tag: 'idle' }
    if (dst.bucket === src?.bucket && dst.name === src.name) {
      return { _tag: 'new-revision' }
    }
    return GQL.fold(packageExistsQuery, {
      data: ({ package: r }) => {
        if (!r) return { _tag: 'new' }
        switch (r.__typename) {
          default:
            return { _tag: 'exists', dst: { bucket: dst.bucket, name: r.name } }
        }
      },
      fetching: () => ({ _tag: 'loading' }),
      error: (error) => ({ _tag: 'error', error }),
    })
  }, [dst, packageExistsQuery, src])
}

function useNameValidator(dst: PackageDst): NameValidationStatus {
  const apiReq = APIConnector.use()
  const req = React.useCallback(async () => {
    // FIXME: debounce
    const res = await apiReq({
      endpoint: '/package_name_valid',
      method: 'POST',
      body: { name: dst.name },
    })
    return res.valid
      ? { _tag: 'ok' as const }
      : { _tag: 'error' as const, error: new Error('Invalid package name') }
  }, [apiReq, dst.name])
  const result = Request.use(req, !!dst.name)
  return React.useMemo(() => {
    if (result === Request.Idle) return { _tag: 'idle' }
    if (result === Request.Loading) return { _tag: 'loading' }
    if (result instanceof Error) return { _tag: 'error', error: result }
    return result
  }, [result])
}

function validateNamePattern(
  dst: PackageDst,
  workflow?: workflows.Workflow,
): NameValidationStatus {
  if (!dst.name) return { _tag: 'error', error: new Error('Enter a package name') }
  if (workflow?.packageNamePattern?.test(dst.name) === false) {
    return {
      _tag: 'error',
      error: new Error(`Name should match ${workflow?.packageNamePattern}`),
    }
  }
  return { _tag: 'ok' }
}

function useNameStatus(
  form: FormStatus,
  dirty: boolean,
  dst: PackageDst,
  src?: PackageSrc,
  workflow?: workflows.Workflow,
): NameStatus {
  const existence = useNameExistence(dst, src)
  const validation = useNameValidator(dst)
  return React.useMemo(() => {
    if (form._tag === 'submitFailed' && form.fields?.name) {
      return { _tag: 'error', error: form.fields.name }
    }
    if (form._tag === 'submitFailed' || dirty) {
      const namePatternValidation = validateNamePattern(dst, workflow)
      if (namePatternValidation._tag !== 'ok') return namePatternValidation
      if (validation._tag !== 'ok') return validation
    }
    return existence
  }, [dirty, form, dst, existence, workflow, validation])
}

function useNameFallback(workflow?: workflows.Workflow) {
  const username = redux.useSelector(authSelectors.username)
  if (!workflow) return undefined
  return getDefaultPackageName(workflow, {
    username,
  })
}

export function useName(
  form: FormStatus,
  dst: PackageDst,
  setDst: React.Dispatch<React.SetStateAction<PackageDst>>,
  src?: PackageSrc,
  workflow?: workflows.Workflow,
): NameState {
  const [dirty, setDirty] = React.useState(false)
  const nameFallback = useNameFallback(workflow)
  React.useEffect(() => {
    if (typeof dst.name === 'undefined') {
      setDst((d) => ({ ...d, name: nameFallback }))
    }
  }, [nameFallback, dst.name, setDst])

  const nameStatus = useNameStatus(form, dirty, dst, src, workflow)
  return React.useMemo(
    () => ({
      value: dst.name,
      status: nameStatus,
      onChange: (n: string) => {
        setDirty(true)
        setDst((d) => ({ ...d, name: n }))
      },
    }),
    [dst, nameStatus, setDst],
  )
}
