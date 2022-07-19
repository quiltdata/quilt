import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as brace from 'brace'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Data from 'utils/Data'
import type { S3HandleBase } from 'utils/s3paths'

import 'brace/mode/markdown'
import 'brace/theme/eclipse'

interface ReadDataArgs {
  s3: S3
  handle: S3HandleBase
}

async function readData({ s3, handle: { bucket, key } }: ReadDataArgs) {
  const res = await s3.getObject({ Bucket: bucket, Key: key }).promise()
  return res.Body!.toString('utf-8')
}

const useEditorTextStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    margin: t.spacing(1, 0, 0),
  },
  editor: {
    minHeight: t.spacing(30),
    border: `1px solid ${t.palette.divider}`,
  },
}))

interface EditorTextProps {
  value: string
  onChange: (value: string) => void
}

function EditorText({ value, onChange }: EditorTextProps) {
  const classes = useEditorTextStyles()
  const ref = React.useRef<HTMLDivElement | null>(null)
  const handleChange = React.useRef(() => {})
  React.useEffect(() => {
    if (!ref.current || !value) return
    const editor = brace.edit(ref.current)
    editor.getSession().setMode('ace/mode/markdown')
    editor.setTheme('ace/theme/eclipse')
    editor.setValue(value, -1)
    handleChange.current = () => onChange(editor.getValue())
    return () => editor.destroy()
  }, [onChange, ref, value])
  return (
    <div className={classes.root}>
      <div className={classes.editor} ref={ref} />
      <div className={classes.actions}>
        <M.Button variant="contained" onClick={handleChange.current} color="primary">
          Save
        </M.Button>
      </div>
    </div>
  )
}

interface EditorTextStateProps {
  handle: S3HandleBase
}

function EditorTextState({ handle }: EditorTextStateProps) {
  const s3 = AWS.S3.use()
  const data = Data.use(readData, {
    s3,
    handle,
  })

  const writeData = React.useCallback(
    async (value) => {
      await s3
        .putObject({ Bucket: handle.bucket, Key: handle.key, Body: value })
        .promise()
    },
    [handle, s3],
  )

  return AsyncResult.case(
    {
      Ok: (value: string) => <EditorText value={value} onChange={writeData} />,
      _: () => null,
    },
    data.result,
  )
}

export default (
  { handle }: EditorTextStateProps,
  props: React.HTMLAttributes<HTMLDivElement>,
) => <EditorTextState {...props} handle={handle} />
