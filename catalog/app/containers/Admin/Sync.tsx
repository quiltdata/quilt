import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as validators from 'utils/validators'

import * as Form from './Form'
import * as Table from './Table'

function useSyncFolders() {
  return React.useMemo(
    () => [
      {
        local: '/home/fiskus/Document/Top Secret Документы',
        s3: 's3://fiskus-sandbox-dev/fiskus/sandbox',
      },
      {
        local: '/home/fiskus/Document/Top Secret Документы',
        s3: 's3://fiskus-sandbox-dev/fiskus/sandbox',
      },
      {
        local: '/home/fiskus/Document/Top Secret Документы',
        s3: 's3://fiskus-sandbox-dev/fiskus/sandbox',
      },
      {
        local: '/home/fiskus/Document/Top Secret Документы',
        s3: 's3://fiskus-sandbox-dev/fiskus/sandbox',
      },
      {
        local: '/home/fiskus/Document/Top Secret Документы',
        s3: 's3://fiskus-sandbox-dev/fiskus/sandbox',
      },
    ],
    [],
  )
}

interface AddFolderProps {
  open: boolean
  onCancel: () => void
  onSubmit: () => void
}

function AddFolder({ open, onCancel, onSubmit }: AddFolderProps) {
  return (
    <M.Dialog open={open}>
      <RF.Form onSubmit={onSubmit} initialValues={{ enableDeepIndexing: true }}>
        {({ handleSubmit, submitting, submitFailed, hasValidationErrors }) => (
          <>
            <M.DialogTitle>Add local &lt;-&gt; s3 folder pair</M.DialogTitle>
            <M.DialogContent>
              <RF.Field
                component={Form.Field}
                name="local"
                label="Local folder"
                placeholder="Folder on local file system"
                validate={validators.required as FF.FieldValidator<any>}
                errors={{
                  required: 'Enter a bucket name',
                }}
                fullWidth
                margin="normal"
              />
              <RF.Field
                component={Form.Field}
                name="s3"
                label="S3 bucket + Package name"
                placeholder="s3://bucket/namespace/package"
                validate={validators.required as FF.FieldValidator<any>}
                errors={{
                  required: 'Enter package name',
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
                onClick={handleSubmit}
                color="primary"
                disabled={submitting || (submitFailed && hasValidationErrors)}
              >
                Add
              </M.Button>
            </M.DialogActions>
          </>
        )}
      </RF.Form>
    </M.Dialog>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 0, 0),
  },
}))

export default function Sync() {
  const classes = useStyles()

  const [addOpen, setAddOpen] = React.useState(false)

  const folders = useSyncFolders()

  const toolbarActions = [
    {
      title: 'Add local ⇄ s3 folder pair',
      icon: <M.Icon>add</M.Icon>,
      fn: () => setAddOpen(true),
    },
  ]

  return (
    <div className={classes.root}>
      <MetaTitle>{['Buckets', 'Admin']}</MetaTitle>

      <AddFolder open={addOpen} onCancel={() => setAddOpen(false)} onSubmit={() => {}} />

      <M.Paper>
        <M.Typography variant="h6"></M.Typography>
        <Table.Toolbar heading="Sync folders" actions={toolbarActions} />
        <M.Table>
          <M.TableHead>
            <M.TableRow>
              <M.TableCell>Local folder</M.TableCell>
              <M.TableCell>S3 folder</M.TableCell>
              <M.TableCell>Actions</M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {folders.map(({ local, s3 }) => (
              <M.TableRow key={local + s3}>
                <M.TableCell>{local}</M.TableCell>
                <M.TableCell>{s3}</M.TableCell>
                <M.TableCell>
                  <M.Tooltip title="Delete">
                    <M.IconButton aria-label="Delete" onClick={() => {}}>
                      <M.Icon>delete</M.Icon>
                    </M.IconButton>
                  </M.Tooltip>
                </M.TableCell>
              </M.TableRow>
            ))}
          </M.TableBody>
        </M.Table>
      </M.Paper>
    </div>
  )
}
