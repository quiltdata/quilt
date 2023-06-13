import hljs from 'highlight.js'
import 'highlight.js/styles/default.css'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Notifications from 'containers/Notifications'
import copyToClipboard from 'utils/clipboard'

import Section from './Section'

function highlight(lang, str) {
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
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(-2),
    marginLeft: t.spacing(3),
    marginTop: t.spacing(-2),
  },
  btn: {
    height: 32,
  },
  code: {
    width: '100%',
  },
  loc: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    overflowX: 'auto',
    overflowY: 'hidden',
    whiteSpace: 'pre',
    minHeight: t.typography.body2.fontSize,
    display: 'flex',
    alignItems: 'flex-end',
    '&:hover $help': {
      opacity: 1,
    },
  },
  help: {
    opacity: 0.3,
    display: 'inline-flex',
    marginLeft: t.spacing(0.5),
  },
  icon: {
    fontSize: '18px',
  },
}))

// children: [{ label: str, contents: str, hl: lang }]
export default function Code({ defaultSelected = 0, children, ...props }) {
  const classes = useStyles()
  const { push } = Notifications.use()

  const [selectedIndex, select] = React.useState(defaultSelected)
  const handleChange = React.useCallback(
    (e, newIdx) => {
      e.stopPropagation()
      if (newIdx == null) return
      select(newIdx)
    },
    [select],
  )

  const selected = children[selectedIndex]

  const handleCopy = React.useCallback(
    (e) => {
      e.stopPropagation()
      copyToClipboard(selected.contents)
      push('Code has been copied to clipboard')
    },
    [selected.contents, push],
  )

  return (
    <Section
      icon="code"
      heading="Code"
      extraSummary={({ expanded }) => (
        <M.Fade in={expanded}>
          <div className={classes.container}>
            <Lab.ToggleButtonGroup
              size="small"
              value={selectedIndex}
              exclusive
              onChange={handleChange}
            >
              {children.map(({ label }, idx) => (
                <Lab.ToggleButton value={idx} key={label} className={classes.btn}>
                  {label}
                </Lab.ToggleButton>
              ))}
            </Lab.ToggleButtonGroup>
            <M.Box ml={1} />
            <M.IconButton onClick={handleCopy} title="Copy to clipboard">
              <M.Icon style={{ fontSize: 18 }}>file_copy</M.Icon>
            </M.IconButton>
          </div>
        </M.Fade>
      )}
      {...props}
    >
      <div className={classes.code}>
        {selected.contents.map((content, index) => (
          <div className={classes.loc} key={selected.label + index}>
            {typeof content === 'string' ? (
              highlight(selected.hl, content)
            ) : (
              <>
                {highlight(selected.hl, content.text)}{' '}
                <a href={content.help} className={classes.help} target="_blank">
                  <M.Icon className={classes.icon}>help_outline</M.Icon>
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}
