import * as requests from './requests'

const backendPermissions: requests.BackendPermissionsData = {
  's3://B-B': 'READ',
  's3://A': 'READ_WRITE',
  's3://Cc': null,
}

const frontendPermissions: requests.BucketPermissionData[] = [
  {
    bucket: 's3://A',
    permission: 'ReadWrite',
  },
  {
    bucket: 's3://B-B',
    permission: 'Read',
  },
  {
    bucket: 's3://Cc',
    permission: 'None',
  },
]

describe('Admin/requests', () => {
  test('convertToBackendPermissions', () => {
    expect(requests.convertToBackendPermissions(frontendPermissions)).toEqual(
      backendPermissions,
    )
  })

  test('convertToFrontendPermissions', () => {
    expect(requests.convertToFrontendPermissions(backendPermissions)).toEqual(
      frontendPermissions,
    )
  })
})
