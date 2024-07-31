import * as Tool from '../Tool'

import { useNavigate } from './navigation'
import { useGetObject } from './preview'

export function useGlobalTools(): Tool.Collection {
  return {
    catalog_global_getObject: useGetObject(),
    navigate: useNavigate(),
  }
}

export { useGlobalTools as use }
