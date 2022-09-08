import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

export const useDataGridStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    width: '100%',
    zIndex: 1, // to prevent receiveing shadow from footer
  },
  header: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
  },
  // TODO: move to components/DataGrid
  '@global': {
    '.MuiDataGridMenu-root': {
      zIndex: t.zIndex.modal + 1, // show menu over modals
    },
  },
  grid: {
    border: 'none',

    '& .MuiDataGrid-overlay': {
      background: fade(t.palette.background.paper, 0.5),
      zIndex: 1,
    },
    '& .MuiDataGrid-cell': {
      outline: 'none !important',
    },
    '& .MuiDataGrid-colCell': {
      '& .MuiDataGrid-colCellTitleContainer': {
        flex: 'none',
      },
      '& .MuiDataGrid-sortIcon': {
        fontSize: 20, // for consistency w/ other icons
      },
      '& .MuiDataGrid-columnSeparator': {
        pointerEvents: 'none',
      },
      '&:last-child': {
        justifyContent: 'flex-end',
        '& .MuiDataGrid-colCellTitleContainer': {
          order: 1,
        },
        '& .MuiDataGrid-colCellTitle': {
          order: 1,
        },
        '& .MuiDataGrid-columnSeparator': {
          display: 'none',
        },
      },
    },
  },
}))
