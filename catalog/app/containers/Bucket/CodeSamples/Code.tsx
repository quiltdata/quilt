import hljs from 'highlight.js'
import 'highlight.js/styles/default.css'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Notifications from 'containers/Notifications'
import * as PackageUri from 'utils/PackageUri'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import Section, { SectionProps } from '../Section'

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

type AnyCodeItem = { label: string; contents: string; hl?: string }

type UriCodeItem = { label: string; contents: PackageUri.PackageUri; hl?: string }

const isUriCodeItem = (x: AnyCodeItem | UriCodeItem): x is UriCodeItem =>
  typeof x.contents !== 'string'

const useLinesOfCodeStyles = M.makeStyles((t) => ({
  loc: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    overflowX: 'auto',
    overflowY: 'hidden',
    whiteSpace: 'pre',
    minHeight: t.typography.body2.fontSize,
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

interface UriProps {
  uri: PackageUri.PackageUri
}

function Uri({ uri }: UriProps) {
  const classes = useLinesOfCodeStyles()
  return (
    <div className={classes.loc}>
      <StyledLink href={PackageUri.stringifyAndAddReferrer(uri, location.host)}>
        {PackageUri.stringify(uri)}
      </StyledLink>
    </div>
  )
}

function LinesOfCode({ label, contents, hl }: AnyCodeItem) {
  const classes = useLinesOfCodeStyles()
  const lines = React.useMemo(
    () =>
      contents.split('\n').map((line, index) => {
        // Find [[ URL ]] and put it to help prop
        const matched = line.match(/(.*) \[\[(.*)\]\]/)
        const key = label + index
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
    [contents, label],
  )
  return (
    <>
      {lines.map(({ help, key, text }) => (
        <div className={classes.loc} key={key}>
          {highlight(text, hl)}
          {help && (
            <StyledLink href={help} className={classes.help} target="_blank">
              [?]
            </StyledLink>
          )}
        </div>
      ))}
    </>
  )
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
}))

interface CodeProps extends Partial<SectionProps> {
  children: (AnyCodeItem | UriCodeItem)[]
  defaultSelected?: number
}

export default function Code({ defaultSelected = 0, children, ...props }: CodeProps) {
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
      copyToClipboard(
        isUriCodeItem(selected)
          ? PackageUri.stringify(selected.contents)
          : selected.contents,
      )
      push('Code has been copied to clipboard')
    },
    [selected, push],
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
        {isUriCodeItem(selected) ? (
          <Uri uri={selected.contents} />
        ) : (
          <LinesOfCode {...selected} />
        )}
      </div>
    </Section>
  )
}
