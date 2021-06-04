import * as R from 'ramda'

interface Role {
  arn: string
  id: string
  name: string
}

export type Permission = 'ReadWrite' | 'Read' | 'None'

export type BackendPermissionsData = Record<string, 'READ_WRITE' | 'READ' | null>

export interface BucketPermissionData {
  bucket: string
  permission: Permission
}

export type BucketsPermissionsData = BucketPermissionData[]

interface RoleBody {
  arn?: string
  name: string
  permissions: BucketPermissionData[]
}

type ApiRequest = $TSFixMe

const FrontendToBackendMap = {
  ReadWrite: 'READ_WRITE',
  Read: 'READ',
  None: null,
}

export function convertToBackendPermissions(
  permissions: BucketPermissionData[],
): BackendPermissionsData {
  return permissions.reduce(
    (memo, { bucket, permission }) => ({
      ...memo,
      [bucket]: FrontendToBackendMap[permission],
    }),
    {},
  )
}

export function convertToFrontendPermissions(
  permissions: BackendPermissionsData,
): BucketPermissionData[] {
  return Object.entries(permissions)
    .map(([bucket, permission]) => ({
      bucket,
      permission: ((): Permission => {
        switch (permission) {
          case 'READ':
            return 'Read'
          case 'READ_WRITE':
            return 'ReadWrite'
          default:
            return 'None'
        }
      })(),
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
}

export function createRole(req: ApiRequest, values: RoleBody): Promise<{ name: string }> {
  try {
    return req({
      endpoint: '/roles',
      method: 'POST',
      body: JSON.stringify(R.assoc('permissions', convertToBackendPermissions, values)),
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating role')
    // eslint-disable-next-line no-console
    console.dir(error)
    throw error
  }
}

export function deleteRole(req: ApiRequest, role: Role) {
  try {
    return req({ endpoint: `/roles/${role.id}`, method: 'DELETE' })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting role')
    // eslint-disable-next-line no-console
    console.dir(error)
    throw error
  }
}

export function updateRole(req: ApiRequest, role: Role, values: RoleBody) {
  try {
    return req({
      endpoint: `/roles/${role.id}`,
      method: 'PUT',
      body: JSON.stringify(R.assoc('permissions', convertToBackendPermissions, values)),
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating role')
    // eslint-disable-next-line no-console
    console.dir(error)
    throw error
  }
}
