import * as React from 'react'
import AceEditor from 'react-ace'
import * as M from '@material-ui/core'

import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-eclipse'

import StyledLink from 'utils/StyledLink'

const ATHENA_REF = 'https://aws.amazon.com/athena/'

const useStyles = M.makeStyles((t) => ({
  editor: {
    padding: t.spacing(1),
  },
  header: {
    margin: t.spacing(0, 0, 1),
  },
}))

interface QueryEditorProps {
  className: string
  onChange: (value: string) => void
  query: string
}

export default function QueryEditor({ className, query, onChange }: QueryEditorProps) {
  const classes = useStyles()

  return (
    <div className={className}>
      <M.Typography className={classes.header} variant="body1">
        Query body
      </M.Typography>
      <M.Paper className={classes.editor}>
        <AceEditor
          editorProps={{ $blockScrolling: true }}
          height="200px"
          mode="sql"
          onChange={onChange}
          theme="eclipse"
          value={query}
          width="100%"
        />
      </M.Paper>
      <M.FormHelperText>
        Quilt uses AWS Athena SQL.
        <StyledLink href={ATHENA_REF} target="_blank">
          Learn more
        </StyledLink>
        .
      </M.FormHelperText>
    </div>
  )
}
