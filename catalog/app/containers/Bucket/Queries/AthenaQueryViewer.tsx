import * as React from 'react'
import AceEditor from 'react-ace'
import * as M from '@material-ui/core'

import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-eclipse'

import StyledLink from 'utils/StyledLink'

const useStyles = M.makeStyles((t) => ({
  editor: {
    padding: t.spacing(1),
  },
  header: {
    margin: t.spacing(0, 0, 1),
  },
}))

interface AthenaQueryViewerProps {
  className: string
  onChange: (value: string) => void
  query: string
}

export default function AthenaQueryViewer({
  className,
  query,
  onChange,
}: AthenaQueryViewerProps) {
  const classes = useStyles()

  return (
    <div className={className}>
      <M.Typography className={classes.header} variant="body1">
        Query body
      </M.Typography>
      <M.Paper className={classes.editor}>
        <AceEditor
          editorProps={{ $blockScrolling: true }}
          height="300px"
          mode="sql"
          onChange={onChange}
          theme="eclipse"
          value={query}
          width="100%"
        />
      </M.Paper>
      <M.FormHelperText>
        Quilt uses AWS Athena SQL.
        <StyledLink href="https://aws.amazon.com/athena/" target="_blank">
          Learn more
        </StyledLink>
        .
      </M.FormHelperText>
    </div>
  )
}
