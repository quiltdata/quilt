import * as Eff from 'effect'
import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as XML from 'utils/XML'

import * as Model from 'containers/Queries/Athena/model/utils'

import type { DatabaseGroup } from './requests'

interface TablesContextProps {
  groups: Model.Data<DatabaseGroup[]>
}

// Pushes the visible table inventory (names + query coordinates) into Qurator
// whenever the Tables tab is open, same pattern as Bucket/DirAssistantContext.
export default Assistant.Context.LazyContext(({ groups }: TablesContextProps) => {
  const msg = React.useMemo(() => {
    if (!Model.hasData(groups)) return Eff.Option.none<string>()
    const tag = XML.tag(
      'tables-inventory',
      {},
      'Tables visible to this stack, by Athena coordinates (catalog.database.table):',
      ...groups.map((g) =>
        XML.tag(
          'database',
          { catalog: g.catalog, name: g.database },
          ...g.tables.map((t) => `${t.name} (${t.format}, ${t.columnCount} columns)`),
        ),
      ),
    )
    return Eff.Option.some(tag.toString())
  }, [groups])
  return {
    markers: { tablesReady: Eff.Option.isSome(msg) },
    messages: Eff.Option.toArray(msg),
  }
})
