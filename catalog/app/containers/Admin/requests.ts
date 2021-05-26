interface Role {
  arn: string
  id: string
  name: string
}

export type Permission = 'ReadWrite' | 'Read' | 'None'

export interface BucketPermissionData {
  bucket: string
  permission: Permission
}

export interface BucketsPermissionsData {
  permissions: BucketPermissionData[]
}

interface RoleBody {
  arn?: string
  name: string
  permissions: BucketsPermissionsData
}

type ApiRequest = $TSFixMe

export function createRole(req: ApiRequest, values: RoleBody): Promise<{ name: string }> {
  try {
    return req({
      endpoint: '/roles',
      method: 'POST',
      body: JSON.stringify(values),
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
      body: JSON.stringify(values),
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating role')
    // eslint-disable-next-line no-console
    console.dir(error)
    throw error
  }
}
