import mkStorage from 'utils/storage'

const ATHENA_WORKGROUP_KEY = 'ATHENA_WORKGROUP'

const ATHENA_CATALOG_KEY = 'ATHENA_CATALOG'

const ATHENA_DATABASE_KEY = 'ATHENA_DATABASE'

const storage = mkStorage({
  athenaCatalog: ATHENA_CATALOG_KEY,
  athenaDatabase: ATHENA_DATABASE_KEY,
  athenaWorkgroup: ATHENA_WORKGROUP_KEY,
})

export const getCatalog = () => storage.get('athenaCatalog')

export const setCatalog = (catalog: string) => storage.set('athenaCatalog', catalog)

export const getDatabase = () => storage.get('athenaDatabase')

export const setDatabase = (database: string) => storage.set('athenaDatabase', database)

export const clearDatabase = () => storage.remove('athenaDatabase')

export const getWorkgroup = () => storage.get('athenaWorkgroup')

export const setWorkgroup = (workgroup: string) =>
  storage.set('athenaWorkgroup', workgroup)
