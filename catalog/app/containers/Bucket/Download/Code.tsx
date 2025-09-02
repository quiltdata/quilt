import hljs from 'highlight.js'
import * as React from 'react'
import * as M from '@material-ui/core'
import {
  HelpOutline as IconHelpOutline,
  FileCopy as IconFileCopy,
} from '@material-ui/icons'

import * as Notifications from 'containers/Notifications'
import copyToClipboard from 'utils/clipboard'

function highlight(str: string, lang?: string) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const { value } = hljs.highlight(str, { language: lang })
      // eslint-disable-next-line react/no-danger
      return <span dangerouslySetInnerHTML={{ __html: value }} />
    } catch (err) {
      console.error(err) // eslint-disable-line no-console
    }
  }
  return str
}

interface LineOfCodeProps {
  className: string
  hl: string
  line: string
}

const LineOfCode = React.memo(({ line, hl, className }: LineOfCodeProps) => {
  const code = React.useMemo(() => highlight(line, hl), [line, hl])
  return <p className={className}>{code}</p>
})

const useStyles = M.makeStyles((t) => ({
  container: {
    background: t.palette.grey[300],
    borderRadius: '2px',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    overflow: 'auto',
    padding: '4px',
    position: 'relative',
  },
  copy: {
    background: t.palette.grey[300],
    marginLeft: t.spacing(1),
    opacity: 0.7,
    padding: t.spacing(0.5),
    position: 'absolute',
    right: 0,
    top: 0,
    '&:hover': {
      opacity: 1,
    },
  },
  help: {
    display: 'inline-block',
    marginLeft: t.spacing(0.5),
    verticalAlign: 'bottom',
  },
  label: {
    marginBottom: t.spacing(0.5),
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
    <div className={className}>
      <M.Typography className={classes.label} variant="subtitle2">
        {label}
        <a href={help} target="_blank" rel="noopener noreferrer" className={classes.help}>
          <M.IconButton size="small">
            <IconHelpOutline fontSize="inherit" />
          </M.IconButton>
        </a>
      </M.Typography>
      <div className={classes.container}>
        <div className={classes.copy}>
          <M.IconButton onClick={handleCopy} title="Copy to clipboard" size="small">
            <IconFileCopy fontSize="inherit" />
          </M.IconButton>
        </div>
        {lines.map((line, index) => (
          <LineOfCode
            className={classes.line}
            hl={hl}
            key={`${line}_${index}`}
            line={line}
          />
        ))}
      </div>
    </div>
  )
}
