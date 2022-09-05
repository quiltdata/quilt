import mkStorage from 'utils/storage'

const ATHENA_WORKGROUP_KEY = 'ATHENA_WORKGROUP'

const storage = mkStorage({ athenaWorkgroup: ATHENA_WORKGROUP_KEY })

export const getWorkgroup = () => storage.get(ATHENA_WORKGROUP_KEY)

export const setWorkgroup = (workgroup: string) =>
  storage.set(ATHENA_WORKGROUP_KEY, workgroup)
