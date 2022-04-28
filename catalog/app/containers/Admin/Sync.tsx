import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as IPC from 'utils/electron/ipc-provider'
import * as s3paths from 'utils/s3paths'
import * as validators from 'utils/validators'

import * as Form from './Form'
import * as Table from './Table'

type LocalFolderInputProps = M.TextFieldProps & Form.FieldProps

export function LocalFolderInput({ input, ...props }: LocalFolderInputProps) {
  const ipc = IPC.use()
  const { onChange } = input

  const handleClick = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [ipc, onChange])

  return <Form.Field onClick={handleClick} size="small" input={input} {...props} />
}

interface DataRow {
  id?: string
  local: string
  s3: string
}

function useSyncFolders(): [null | DataRow[], () => void] {
  const ipc = IPC.use()
  const [key, setKey] = React.useState(1)
  const inc = React.useCallback(() => setKey(R.inc), [setKey])
  const [folders, setFolders] = React.useState<null | DataRow[]>(null)
  React.useEffect(() => {
    async function fetchData() {
      const config = await ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_LIST)
      setFolders(config.folders)
    }

    fetchData()
  }, [ipc, key])
  return [folders, inc]
}

interface ConfirmDeletionDialogProps {
  onCancel: () => void
  onSubmit: (v: DataRow) => void
  value: DataRow | null
}

function ConfirmDeletionDialog({
  onCancel,
  onSubmit,
  value,
}: ConfirmDeletionDialogProps) {
  const handleSubmit = React.useCallback(() => {
    if (value) onSubmit(value)
  }, [onSubmit, value])
  return (
    <M.Dialog open={!!value}>
      <M.DialogTitle>Remove local ⇄ s3 folder pair</M.DialogTitle>
      <M.DialogContent>
        Confirm deletion of {value?.local}⇄{value?.s3} sync pair
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary">
          Cancel
        </M.Button>
        <M.Button color="primary" onClick={handleSubmit} variant="contained">
          Remove
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface ManageFolderDialogProps {
  onCancel: () => void
  onSubmit: (v: DataRow) => void
  value: Partial<DataRow> | null
}

function ManageFolderDialog({ onCancel, onSubmit, value }: ManageFolderDialogProps) {
  return (
    <M.Dialog open={!!value}>
      <RF.Form onSubmit={onSubmit} initialValues={value}>
        {({ handleSubmit, submitting, submitFailed, hasValidationErrors }) => (
          <>
            <M.DialogTitle>Add local ⇄ s3 folder pair</M.DialogTitle>
            <M.DialogContent>
              <RF.Field
                component={LocalFolderInput}
                name="local"
                label="Local folder"
                placeholder="Folder on local file system"
                validate={validators.required as FF.FieldValidator<any>}
                errors={{
                  required: 'Path to local directory is required',
                }}
                fullWidth
                margin="normal"
              />
              <RF.Field
                component={Form.Field}
                name="s3"
                label="S3 bucket + Package name"
                placeholder="s3://bucket/namespace/package"
                validate={
                  validators.composeAnd(
                    validators.required,
                    validators.s3Url,
                  ) as FF.FieldValidator<any>
                }
                errors={{
                  required: 'S3 URL is required',
                  s3Url: 'Enter valid S3 URL to package',
                }}
                fullWidth
                margin="normal"
              />
            </M.DialogContent>
            <M.DialogActions>
              <M.Button onClick={onCancel} color="primary" disabled={submitting}>
                Cancel
              </M.Button>
              <M.Button
                color="primary"
                disabled={submitting || (submitFailed && hasValidationErrors)}
                onClick={handleSubmit}
                variant="contained"
              >
                {value ? 'Save' : 'Add'}
              </M.Button>
            </M.DialogActions>
          </>
        )}
      </RF.Form>
    </M.Dialog>
  )
}
const useTableRowStyles = M.makeStyles({
  action: {
    opacity: 0.3,
    'tr:hover &': {
      opacity: 1,
    },
  },
})

interface TableRowProps {
  onEdit: (v: DataRow) => void
  onRemove: (v: DataRow) => void
  row: DataRow
}

function TableRow({ onEdit, onRemove, row }: TableRowProps) {
  const classes = useTableRowStyles()
  const { urls } = NamedRoutes.use()
  const handle = s3paths.parseS3Url(row.s3)
  const handleRemove = React.useCallback(() => onRemove(row), [onRemove, row])
  const handleEdit = React.useCallback(() => onEdit(row), [onEdit, row])
  return (
    <M.TableRow hover>
      <M.TableCell>{row.local}</M.TableCell>
      <M.TableCell>
        <StyledLink to={urls.bucketPackageDetail(handle.bucket, handle.key)}>
          {row.s3}
        </StyledLink>
      </M.TableCell>
      <M.TableCell align="right">
        <M.Tooltip title="Remove">
          <M.IconButton
            className={classes.action}
            aria-label="Remove"
            onClick={handleRemove}
          >
            <M.Icon>delete</M.Icon>
          </M.IconButton>
        </M.Tooltip>
        <M.Tooltip title="Edit">
          <M.IconButton className={classes.action} aria-label="Edit" onClick={handleEdit}>
            <M.Icon>edit</M.Icon>
          </M.IconButton>
        </M.Tooltip>
      </M.TableCell>
    </M.TableRow>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 0, 0),
  },
}))

export default function Sync() {
  const classes = useStyles()
  const ipc = IPC.use()

  const [selected, setSelected] = React.useState<Partial<DataRow> | null>(null)
  const [removing, setRemoving] = React.useState<DataRow | null>(null)

  const [folders, inc] = useSyncFolders()

  const toolbarActions = React.useMemo(
    () =>
      folders
        ? [
            {
              title: 'Add local ⇄ s3 folder pair',
              icon: <M.Icon>add</M.Icon>,
              fn: () => {
                setSelected({})
              },
            },
          ]
        : [],
    [folders],
  )

  const handleRemove = React.useCallback(
    async (row: DataRow) => {
      await ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_REMOVE, row)

      setRemoving(null)
      inc()
    },
    [inc, ipc],
  )

  const handleEdit = React.useCallback(
    async (row: DataRow) => {
      await ipc.invoke(
        row.id ? IPC.EVENTS.SYNC_FOLDERS_EDIT : IPC.EVENTS.SYNC_FOLDERS_ADD,
        row,
      )

      setSelected(null)
      inc()
    },
    [inc, ipc],
  )

  return (
    <div className={classes.root}>
      <MetaTitle>{['Sync Folders', 'Admin']}</MetaTitle>

      <ManageFolderDialog
        onCancel={() => setSelected(null)}
        onSubmit={handleEdit}
        value={selected}
      />

      <ConfirmDeletionDialog
        onCancel={() => setRemoving(null)}
        onSubmit={handleRemove}
        value={removing}
      />

      <M.Paper>
        <Table.Toolbar heading="Sync folders" actions={toolbarActions} />
        {folders ? (
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell>Local folder</M.TableCell>
                <M.TableCell>S3 folder</M.TableCell>
                <M.TableCell align="right">Actions</M.TableCell>
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>
              {folders.map((row) => (
                <TableRow
                  key={row.id}
                  onEdit={setSelected}
                  onRemove={setRemoving}
                  row={row}
                />
              ))}
            </M.TableBody>
          </M.Table>
        ) : (
          <Table.Progress />
        )}
      </M.Paper>
    </div>
  )
}
