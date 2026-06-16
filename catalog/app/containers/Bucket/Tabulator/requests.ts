import * as GQL from 'utils/GraphQL'

import * as Model from '../Queries/Athena/model/utils'

import TABULATOR_TABLES_QUERY from './gql/TabulatorTables.generated'

export interface TabulatorTable {
  name: string
}

export function useTabulatorTables(
  bucket: string,
): Model.Data<readonly TabulatorTable[]> {
  const result = GQL.useQuery(TABULATOR_TABLES_QUERY, { bucket })
  return GQL.fold(result, {
    // A null `bucketConfig` (not found / no access) is treated as "no tables".
    data: (d) => d.bucketConfig?.tabulatorTables ?? [],
    fetching: () => Model.Loading,
    error: (e) => e,
  })
}
