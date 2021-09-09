import * as React from 'react'
import { Link, LinkProps } from 'react-router-dom'
import * as M from '@material-ui/core'
import Layout from 'components/Layout'
import Spinner from 'components/Spinner'

const useContainerStyles = M.makeStyles({
  root: {
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: 300,
    width: '100%',
  },
})

export function Container(props: React.HTMLAttributes<HTMLDivElement>) {
  const classes = useContainerStyles()
  return <div className={classes.root} {...props} />
}

export function Heading(props: M.TypographyProps) {
  return <M.Typography variant="h4" align="center" {...props} />
}

interface FieldOwnProps {
  // TODO: use final-form type definitions
  input: {}
  meta: {
    error?: string
    submitError?: string
    submitFailed: boolean
  }
  // for backwards compatibility
  floatingLabelText?: React.ReactNode
  errors: Record<string, React.ReactNode>
}

type FieldProps = FieldOwnProps & M.TextFieldProps

export function Field({
  input,
  meta,
  errors,
  floatingLabelText: label,
  ...rest
}: FieldProps) {
  const err = meta.error || meta.submitError
  const props = {
    error: meta.submitFailed && !!err,
    helperText: meta.submitFailed && err ? errors[err] || err : undefined,
    label,
    fullWidth: true,
    margin: 'normal' as const,
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

const useFieldErrorLinkStyles = M.makeStyles({
  root: {
    color: 'inherit !important',
    textDecoration: 'underline',
  },
})

export function FieldErrorLink(props: LinkProps) {
  const classes = useFieldErrorLinkStyles()
  return <Link className={classes.root} {...props} />
}

const useErrorStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.error.main,
    marginTop: t.spacing(3),
    textAlign: 'center',

    '& a': {
      color: 'inherit !important',
      textDecoration: 'underline',
    },
  },
}))

interface ErrorProps {
  submitFailed: boolean
  error: string
  errors: Record<string, React.ReactNode>
}

export function Error({ submitFailed, error, errors, ...rest }: ErrorProps) {
  const classes = useErrorStyles()
  const err = submitFailed && error ? errors[error] || error : undefined
  return err ? (
    <p className={classes.root} {...rest}>
      {err}
    </p>
  ) : null
}

const useActionsStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(4),
  },
}))

export function Actions(props: React.HTMLAttributes<HTMLDivElement>) {
  const classes = useActionsStyles()
  return <div className={classes.root} {...props} />
}

const useHintStyles = M.makeStyles((t) => ({
  root: {
    fontSize: 12,
    lineHeight: '16px',
    marginBottom: t.spacing(1.5),
    marginTop: t.spacing(4),
    textAlign: 'center',

    // TODO: this selector is quite fragile, we should fix this
    'p + &': {
      marginTop: t.spacing(1.5),
    },
  },
}))

export function Hint(props: React.HTMLAttributes<HTMLParagraphElement>) {
  const classes = useHintStyles()
  return <p className={classes.root} {...props} />
}

export function Message(props: M.TypographyProps) {
  return (
    <M.Box pt={2}>
      <M.Typography align="center" {...props} />
    </M.Box>
  )
}

interface LayoutProps {
  children: React.ReactNode
}

type LayoutHeading = React.ReactNode | ((props: {}) => React.ReactNode)

export const mkLayout =
  (heading: LayoutHeading) =>
  ({ children, ...props }: LayoutProps) =>
    (
      <Layout>
        <Container>
          <M.Box pt={5} pb={2}>
            <Heading>{typeof heading === 'function' ? heading(props) : heading}</Heading>
          </M.Box>
          {children}
        </Container>
      </Layout>
    )

interface SubmitProps extends M.ButtonProps {
  busy: boolean
  // TODO: deprecate
  label?: React.ReactNode
}

export function Submit({ busy, label, children, ...rest }: SubmitProps) {
  return (
    <M.Button color="primary" variant="contained" type="submit" {...rest}>
      {label}
      {children}
      {busy && (
        <>
          &nbsp;
          <Spinner
            style={{
              fontSize: '1.5em',
              opacity: '.5',
              position: 'absolute',
              right: '-1.5em',
            }}
          />
        </>
      )}
    </M.Button>
  )
}

const useOrStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: t.spacing(4),
  },
  divider: {
    flexGrow: 1,
  },
  text: {
    paddingLeft: t.spacing(1),
    paddingRight: t.spacing(1),
  },
}))

export function Or() {
  const classes = useOrStyles()
  return (
    <div className={classes.root}>
      <M.Divider className={classes.divider} />
      <M.Typography variant="button" className={classes.text}>
        Or
      </M.Typography>
      <M.Divider className={classes.divider} />
    </div>
  )
}
