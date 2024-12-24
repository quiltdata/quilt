import * as React from 'react'
import * as DG from '@material-ui/data-grid'

export * from '@material-ui/data-grid'

export type DataGridProps = Omit<DG.GridComponentProps, 'licenseStatus'>

export const DataGrid = React.memo(
  React.forwardRef<HTMLDivElement, DataGridProps>(function DataGrid(inProps, ref) {
    const props = DG.useThemeProps({ props: inProps, name: 'MuiDataGrid' })
    return <DG.GridComponent ref={ref} {...props} licenseStatus="Valid" />
  }),
)

// monkey-patch MUI built-in colDef to better align checkboxes
DG.gridCheckboxSelectionColDef.width = 32
