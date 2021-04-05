import type * as RTable from 'react-table'

declare module 'react-table' {
  export interface TableOptions extends RTable.TableOptions {
    updateMyData: (path: any, id: any, value: any) => void
  }
}
