import { Schema as S } from 'effect'

import SearchRoute from 'containers/Search/Route'
import * as SearchModel from 'containers/Search/model'

// params -> location
const encode = S.encodeSync(SearchRoute.paramsSchema)

export const makeUrl = (bucket: string, workflow: string) =>
  encode({
    buckets: [bucket],
    ordering: 'sys:modified:desc',
    params: {
      resultType: SearchModel.ResultType.QuiltPackage,
      filter: [
        {
          key: 'workflow',
          predicate: { terms: [workflow] },
        },
      ],
    },
  })
