import * as Tool from '../Tool'

import { useStartSearch } from './search'
import { useGetObject } from './preview'

export function useGlobalTools(): Tool.Collection {
  return {
    catalog_global_startSearch: useStartSearch(),
    catalog_global_getObject: useGetObject(),
  }
}

export { useGlobalTools as use }
