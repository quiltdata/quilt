import * as React from 'react'
import * as M from '@material-ui/core'

import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

import { docs } from 'constants/urls'
import * as JsonEditorToolbar from 'components/JsonEditor/Toolbar'
import * as Dialogs from 'utils/GlobalDialogs'
import * as JSONPointer from 'utils/JSONPointer'
import StyledLink from 'utils/StyledLink'

import { ConfigDetailsProps } from './Dummy'

function AddFile() {
  const [advanced, setAdvanced] = React.useState(false)
  return (
    <div>
      <M.TextField label="Path" />
      <M.FormControlLabel
        control={
          <M.Switch
            checked={advanced}
            onChange={(_e, checked) => setAdvanced(checked)}
            size="small"
            color="primary"
          />
        }
        label="Advanced"
      />
      {advanced && (
        <>
          <M.TextField label="Format" />
        </>
      )}
    </div>
  )
}

const useToolbarStyles = M.makeStyles({
  root: {},
})

function Toolbar({ columnPath }: JsonEditorToolbar.ToolbarProps) {
  const openDialog = Dialogs.use()
  const classes = useToolbarStyles()
  const pointer = JSONPointer.stringify(columnPath)
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const button = (
    <M.IconButton
      className={classes.root}
      onClick={(event) => setAnchorEl(event.currentTarget)}
      size="small"
    >
      <M.Icon>add_circle_outline</M.Icon>
    </M.IconButton>
  )
  const addSingleFile = React.useCallback(() => {
    openDialog(() => <AddFile />)
  }, [openDialog])
  if (pointer === '/0') {
    return (
      <>
        <M.Menu anchorEl={anchorEl} open={!!anchorEl}>
          <M.MenuItem onClick={addSingleFile}>Add file</M.MenuItem>
          <M.MenuItem>Add multiple files in one row</M.MenuItem>
        </M.Menu>
        {button}
      </>
    )
  }
  return null
}

const toolbarOptions = {
  Toolbar,
}

function Header() {
  return (
    <M.Typography variant="body2">
      Configuration for Catalog UI: show and hide features, set default values. See{' '}
      <StyledLink
        href={`${docs}/quilt-platform-administrator/preferences`}
        target="_blank"
      >
        the docs
      </StyledLink>
    </M.Typography>
  )
}

export default function QuiltSummarize({ children }: ConfigDetailsProps) {
  return (
    <JsonEditorToolbar.Provider value={toolbarOptions}>
      {children({ header: <Header />, schema: quiltSummarizeSchema })}
    </JsonEditorToolbar.Provider>
  )
}
