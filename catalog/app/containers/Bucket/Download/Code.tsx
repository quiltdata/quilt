import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Notifications from 'containers/Notifications'
import copyToClipboard from 'utils/clipboard'
import HljsBoundary from 'utils/HljsBoundary'
import hljs, { RegisteredLanguage, ensureLanguages } from 'utils/hljs'

function highlight(str: string, lang?: RegisteredLanguage) {
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
  hl: RegisteredLanguage
  line: string
}

function CodeLines({
  lines,
  hl,
  className,
}: {
  lines: string[]
  hl: RegisteredLanguage
  className: string
}) {
  ensureLanguages([hl])
  return (
    <>
      {lines.map((line, index) => (
        <LineOfCode className={className} hl={hl} key={`${line}_${index}`} line={line} />
      ))}
    </>
  )
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
  hl: RegisteredLanguage
  label: string
}

export default function Code({ className, help, hl, label, lines }: CodeProps) {
  const classes = useStyles()
  const { push } = Notifications.use()

  const handleCopy = React.useCallback(() => {
    copyToClipboard(lines.join('\n'))
    push('Code has been copied to clipboard')
  }, [lines, push])

  return (
    <div className={className}>
      <M.Typography className={classes.label} variant="subtitle2">
        {label}
        <a href={help} target="_blank" rel="noopener noreferrer" className={classes.help}>
          <M.IconButton size="small">
            <Icons.HelpOutline fontSize="inherit" />
          </M.IconButton>
        </a>
      </M.Typography>
      <div className={classes.container}>
        <div className={classes.copy}>
          <M.IconButton onClick={handleCopy} title="Copy to clipboard" size="small">
            <Icons.FileCopy fontSize="inherit" />
          </M.IconButton>
        </div>
        <HljsBoundary
          fallback={
            <>
              {lines.map((line, index) => (
                <p className={classes.line} key={`${line}_${index}`}>
                  {line}
                </p>
              ))}
            </>
          }
        >
          <CodeLines className={classes.line} hl={hl} lines={lines} />
        </HljsBoundary>
      </div>
    </div>
  )
}
