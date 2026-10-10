import * as React from 'react'
import * as M from '@material-ui/core'

import type { JsonSchema } from 'utils/JSONSchema'
import type * as Types from 'utils/types'

import { parsePastedFields } from '../State/metaPaste'

interface PasteFieldsProps {
  onClose: () => void
  /** Called with the parsed fields; they replace same-named values, since the user pasted them. */
  onPaste: (fields: Types.JsonRecord) => void
  open: boolean
  schema?: JsonSchema
}

/** Design B: paste two spreadsheet columns (name, value) into the property grid. */
export default function PasteFields({
  onClose,
  onPaste,
  open,
  schema,
}: PasteFieldsProps) {
  const [text, setText] = React.useState('')
  const parsed = React.useMemo(() => parsePastedFields(text, schema), [schema, text])
  const count = Object.keys(parsed.fields).length

  const close = () => {
    setText('')
    onClose()
  }

  return (
    <M.Dialog fullWidth maxWidth="sm" onClose={close} open={open}>
      <M.DialogTitle>Paste from Excel</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          Copy two columns, field name then value, and paste them here. Fields you paste
          replace the same fields in the table.
        </M.DialogContentText>
        <M.TextField
          autoFocus
          fullWidth
          inputProps={{ 'aria-label': 'Pasted rows', spellCheck: false }}
          rows={6}
          multiline
          onChange={(e) => setText(e.target.value)}
          placeholder={'project\tONC-104\nsample_count\t24'}
          value={text}
          variant="outlined"
        />
        {!!parsed.skipped.length && (
          <M.Typography color="error" role="alert" variant="body2">
            {parsed.skipped.length} line{parsed.skipped.length === 1 ? '' : 's'} skipped:
            no value, a reserved name, or a number that cannot be stored exactly (use text
            for IDs).
          </M.Typography>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close}>Cancel</M.Button>
        <M.Button
          color="primary"
          disabled={!count}
          onClick={() => {
            onPaste(parsed.fields)
            close()
          }}
          variant="contained"
        >
          {count ? `Add ${count} field${count === 1 ? '' : 's'}` : 'Add fields'}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
