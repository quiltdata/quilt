import cx from 'classnames'
import hljs from 'highlight.js'
import 'highlight.js/styles/default.css'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import copyToClipboard from 'utils/clipboard'

function highlight(str: string, lang?: string) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const { value } = hljs.highlight(str, { language: lang })
      // eslint-disable-next-line react/no-danger
      return <span dangerouslySetInnerHTML={{ __html: value }} />
    } catch (err) {
      // istanbul ignore next
      console.error(err) // eslint-disable-line no-console
    }
  }
  return str
}

const useStyles = M.makeStyles((t) => ({
  container: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,

    background: t.palette.grey[300],
    borderRadius: '2px',
    overflow: 'auto',
    padding: '4px',
    position: 'relative',
  },
  label: {
    alignItems: 'center',
    display: 'inline-flex',
  },
  btn: {
    marginLeft: t.spacing(1),
    position: 'absolute',
    right: '4px',
    top: '4px',
  },
  root: {
    width: '100%',
  },
  line: {
    textIndent: t.spacing(-4),
    paddingLeft: t.spacing(4),
  },
}))

interface CodeProps {
  lines: string[]
  className: string
  help: string
  hl: string
  label: string
}

export default function Code({ className, help, hl, label, lines }: CodeProps) {
  const classes = useStyles()
  const { push } = Notifications.use()

  const handleCopy = React.useCallback(
    (e) => {
      e.stopPropagation()
      copyToClipboard(lines.join('\n'))
      push('Code has been copied to clipboard')
    },
    [lines, push],
  )

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography className={classes.label} variant="subtitle2" gutterBottom>
        {label}
        <a href={help} target="_blank">
          <M.IconButton size="small" style={{ marginLeft: '4px' }}>
            <M.Icon fontSize="inherit">help</M.Icon>
          </M.IconButton>
        </a>
      </M.Typography>
      <div className={classes.container}>
        <M.IconButton
          onClick={handleCopy}
          title="Copy to clipboard"
          size="small"
          className={classes.btn}
        >
          <M.Icon fontSize="inherit">file_copy</M.Icon>
        </M.IconButton>
        {lines.map((line, index) => (
          <p key={`${line}_${index}`} className={classes.line}>
            {highlight(line, hl)}
          </p>
        ))}
      </div>
    </div>
  )
}
