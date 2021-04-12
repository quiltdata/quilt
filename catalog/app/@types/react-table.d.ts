import type * as RTable from 'react-table'

declare module 'react-table' {
  export interface TableOptions extends RTable.TableOptions {
    updateMyData: (path: string[], id: any, value: any) => void
  }
}
