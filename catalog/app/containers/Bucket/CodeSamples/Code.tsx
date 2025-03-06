import cx from 'classnames'
import hljs from 'highlight.js'
import 'highlight.js/styles/default.css'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import StyledLink from 'utils/StyledLink'
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

const useLineOfCodeStyles = M.makeStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    minHeight: t.typography.body2.fontSize,
    whiteSpace: 'pre',
    '&:hover $help': {
      opacity: 1,
    },
  },
  help: {
    display: 'inline-block',
    marginLeft: t.spacing(0.5),
    opacity: 0.3,
  },
}))

interface LineOfCodeProps {
  lang?: string
  text: string
  help?: string
}
function LineOfCode({ lang, text, help }: LineOfCodeProps) {
  const classes = useLineOfCodeStyles()
  return (
    <div className={classes.root}>
      {lang === 'uri' ? (
        <StyledLink href={text} target={text.startsWith('http') ? '_blank' : '_self'}>
          {text}
        </StyledLink>
      ) : (
        highlight(text, lang)
      )}
      {help && (
        <StyledLink href={help} className={classes.help} target="_blank">
          [?]
        </StyledLink>
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  container: {
    borderRadius: '2px',
    overflow: 'auto',
    background: t.palette.grey[300],
    padding: '4px',
  },
  label: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  btn: {
    marginLeft: t.spacing(1),
  },
  root: {
    width: '100%',
  },
}))

interface CodeProps {
  className: string
  children: { label: string; contents: string; hl?: string }
}

export default function Code({ className, children }: CodeProps) {
  const classes = useStyles()
  const { push } = Notifications.use()

  const handleCopy = React.useCallback(
    (e) => {
      e.stopPropagation()
      copyToClipboard(children.contents)
      push('Code has been copied to clipboard')
    },
    [children.contents, push],
  )

  const lines = React.useMemo(
    () =>
      children.contents.split('\n').map((line, index) => {
        // Find [[ URL ]] and put it to help prop
        const matched = line.match(/(.*) \[\[(.*)\]\]/)
        const key = children.label + index
        if (!matched || !matched[1] || !matched[2]) {
          return {
            key,
            text: line,
          }
        }
        return {
          help: matched[2],
          key,
          text: matched[1],
        }
      }),
    [children.contents, children.label],
  )

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography className={classes.label} variant="subtitle2" gutterBottom>
        {children.label}
        <M.IconButton
          onClick={handleCopy}
          title="Copy to clipboard"
          size="small"
          className={classes.btn}
        >
          <M.Icon fontSize="inherit">file_copy</M.Icon>
        </M.IconButton>
      </M.Typography>
      <div className={classes.container}>
        {lines.map((line) => (
          <LineOfCode
            help={line.help}
            key={line.key}
            lang={children.hl}
            text={line.text}
          />
        ))}
      </div>
    </div>
  )
}
