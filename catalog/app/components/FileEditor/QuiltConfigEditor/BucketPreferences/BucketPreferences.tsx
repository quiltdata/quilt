import cx from 'classnames'
import React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonValidationErrors from 'components/JsonValidationErrors'
import { docs } from 'constants/urls'
import * as BucketConfig from 'utils/BucketConfig'
import StyledLink from 'utils/StyledLink'

import type { QuiltConfigEditorProps } from '../QuiltConfigEditor'

import PackageDescription from './PackageDescription'
import { parse, stringify } from './State'
import type { Config, TypedValue, KeyedValue } from './State'

const useFieldStyles = M.makeStyles((t) => ({
  margin: {
    marginTop: t.spacing(1),
  },
}))

const useInputBooleanStyles = M.makeStyles((t) => ({
  checkbox: {
    margin: t.spacing(-1, 0),
  },
}))

function InputBoolean({
  className,
  disabled,
  onChange,
  size,
  value: { key, value },
}: FieldProps<TypedValue<boolean>>) {
  const classes = useInputBooleanStyles()
  const handleChange = React.useCallback(
    (_e, checked: boolean) => onChange({ isDefault: false, key, value: checked }),
    [key, onChange],
  )
  return (
    <M.FormControl className={className}>
      <M.FormControlLabel
        control={
          <M.Checkbox
            checked={!!value}
            className={classes.checkbox}
            onChange={handleChange}
            size={size}
          />
        }
        disabled={disabled}
        label={i18n(key)}
      />
    </M.FormControl>
  )
}

function InputValue({
  className,
  onChange,
  value: { key, value },
  ...props
}: FieldProps<TypedValue<string>>) {
  const handleChange = React.useCallback(
    (event) => onChange({ isDefault: false, key, value: event.target.value }),
    [key, onChange],
  )
  return (
    <M.TextField
      {...props}
      InputLabelProps={{
        shrink: true,
      }}
      className={className}
      label={i18n(key)}
      value={value}
      onChange={handleChange}
    />
  )
}

function InputDefaultSourceBucket({
  config,
  onChange,
  value: { key, value },
  size,
  className,
  disabled,
}: FieldPropsWithConfig<TypedValue<string>>) {
  const options = config['ui.source_buckets'].value
  const handleChange = React.useCallback(
    (event) => onChange({ isDefault: false, value: event.target.value as string, key }),
    [key, onChange],
  )
  return (
    <M.FormControl
      className={className}
      disabled={!options.length || disabled}
      fullWidth
      size={size}
    >
      <M.InputLabel>Default bucket</M.InputLabel>
      <M.Select value={value || options[0] || ''} onChange={handleChange}>
        {options.map((bucket) => (
          <M.MenuItem key={bucket} value={bucket}>
            {bucket}
          </M.MenuItem>
        ))}
      </M.Select>
    </M.FormControl>
  )
}

function InputSourceBuckets({
  className,
  value: { key, value },
  onChange,
  ...props
}: FieldProps<TypedValue<string[]>>) {
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const options = React.useMemo(
    () => bucketConfigs.map((b) => `s3://${b.name}`),
    [bucketConfigs],
  )
  const handleChange = React.useCallback(
    (_e, buckets: string[]) => onChange({ isDefault: false, key, value: buckets }),
    [key, onChange],
  )
  return (
    <Lab.Autocomplete
      className={className}
      style={{ marginTop: '8px' }}
      multiple
      onChange={handleChange}
      options={options}
      renderInput={(params) => (
        <M.TextField
          {...params}
          InputLabelProps={{
            shrink: true,
          }}
          label="Allowed buckets"
          placeholder="s3://quilt-example"
        />
      )}
      value={value}
      {...props}
    />
  )
}

function InputPackageDescription({
  value: { key, value },
  onChange,
  ...props
}: FieldProps<KeyedValue<'ui.package_description'>>) {
  const handleChange = React.useCallback(
    (v: KeyedValue<'ui.package_description'>['value']) =>
      onChange({ isDefault: false, key, value: v }),
    [key, onChange],
  )
  return <PackageDescription {...props} onChange={handleChange} value={value} />
}

const I18N = {
  'ui.actions': {
    title: 'Actions',
    description: 'Show or hide buttons in the UI',
  },
  'ui.actions.copyPackage': '"PUSH TO BUCKET" on the package page',
  'ui.actions.createPackage':
    '"CREATE PACKAGE" on the package list and bucket listing pages',
  'ui.actions.deleteRevision': '"DELETE REVISION" menu item on the package page',
  'ui.actions.downloadObject': 'Download buttons for files in a "BUCKET" tab',
  'ui.actions.downloadPackage': 'Download buttons for files in a "PACKAGE" tab',
  'ui.actions.revisePackage': '"REVISE PACKAGE" on the package page',
  'ui.actions.writeFile': 'Buttons to create or edit files',

  'ui.qurator': 'Qurator',

  'ui.athena': 'Athena',
  'ui.athena.defaultWorkgroup': 'Default workgroup for Athena queries',

  'ui.blocks': {
    title: 'Sections',
    description: 'Show or hide sections in the UI',
  },
  'ui.blocks.gallery': {
    title: 'Gallery',
    description: 'Show or hide image galleries',
  },
  'ui.blocks.analytics': '"ANALYTICS" on the file page',
  'ui.blocks.browser': 'File listings on bucket and packages pages',
  'ui.blocks.code': '"CODE"',
  'ui.blocks.meta': '"METADATA"',
  'ui.blocks.qurator': 'Enable Qurator assistance',

  'ui.blocks.meta.*.expanded': {
    title: 'Metadata in the package list',
    description: 'Auto-expand JSON blocks in Metadata section',
  },
  'ui.blocks.meta.user_meta.expanded': 'User metadata',
  'ui.blocks.meta.workflows.expanded': 'Workflow',

  'ui.blocks.gallery.files': 'Images in the directory listing on bucket pages',
  'ui.blocks.gallery.overview': 'Images on the Bucket overview page',
  'ui.blocks.gallery.packages': 'Images in the directory listing on the package page',
  'ui.blocks.gallery.summarize':
    'Image galleries alongside those defined in quilt_summarize.json',

  'ui.nav': {
    title: 'Navigation items',
    description: 'Show or hide tabs at the top of the bucket pages',
  },
  'ui.nav.files': '"BUCKET"',
  'ui.nav.packages': '"PACKAGES"',
  'ui.nav.queries': '"QUERIES"',

  'ui.source_buckets': {
    title: 'Source buckets for packages',
    description:
      'List of these buckets will be offered when users click on "ADD FILES FROM BUCKET" in Revise Package dialog',
  },
  'ui.package_description': {
    title: 'Package list appearance (per package settings)',
    description: 'Match packages with RegExp or implicitly use package names',
  },
  'ui.package_description.all': 'Package list appearance (all packages)',
  'ui.package_description.multiline': 'Display `user_meta` on multiple lines',
}

function i18n(key: string): string | { title: string; description: string } {
  return I18N[key as keyof typeof I18N] ?? key
}

interface FieldProps<V = KeyedValue> {
  className?: string
  disabled?: boolean
  value: V
  size: 'small' | 'medium'
  onChange: (v: V) => void
}

interface FieldPropsWithConfig<V = KeyedValue> extends FieldProps<V> {
  config: Config
}

function Field({ config, value, ...props }: FieldPropsWithConfig) {
  const classes = useFieldStyles()

  if (value.key === 'ui.actions.openInDesktop') return null

  if (value.key === 'ui.package_description') {
    return (
      <InputPackageDescription
        {...props}
        className={cx(props.className, classes.margin)}
        value={value as KeyedValue<'ui.package_description'>}
      />
    )
  }

  if (value.key === 'ui.source_buckets') {
    return (
      <InputSourceBuckets
        {...props}
        className={cx(props.className, classes.margin)}
        value={value as KeyedValue<'ui.source_buckets'>}
      />
    )
  }

  if (value.key === 'ui.source_buckets.default') {
    return (
      <InputDefaultSourceBucket
        {...props}
        className={cx(props.className, classes.margin)}
        config={config}
        value={value as KeyedValue<'ui.source_buckets.default'>}
      />
    )
  }

  if (typeof value.value === 'string') {
    return <InputValue {...props} value={value as TypedValue<string>} />
  }

  if (
    typeof value.value === 'boolean' ||
    value.key === 'ui.blocks.meta.user_meta.expanded' ||
    value.key === 'ui.blocks.meta.workflows.expanded'
  ) {
    return <InputBoolean {...props} value={value as TypedValue<boolean>} />
  }

  throw new Error('Unsupported field')
}

const useGroupStyles = M.makeStyles((t) => ({
  duplex: {
    gridTemplateColumns: '1fr 1fr',
  },
  title: {
    marginBottom: t.spacing(1),
  },
  description: {
    marginTop: t.spacing(0.5),
  },
  layout: {
    display: 'grid',
    gridColumnGap: t.spacing(8),
    gridRowGap: t.spacing(1),
  },
}))

interface GroupProps {
  className: string
  config: Config
  disabled?: boolean
  id: keyof typeof I18N
  onChange: (v: KeyedValue) => void
  values: Config[keyof Config][]
}

function Group({ className, config, disabled, id, onChange, values }: GroupProps) {
  const classes = useGroupStyles()
  const groupI18n = i18n(id)
  const title = typeof groupI18n === 'string' ? groupI18n : groupI18n.title
  const description = typeof groupI18n !== 'string' && groupI18n.description
  const layout = React.useMemo(() => {
    switch (id) {
      case 'ui.blocks.meta.*.expanded':
      case 'ui.nav':
      case 'ui.package_description':
        return 1
      default:
        return values.length > 1 ? 2 : 1
    }
  }, [id, values])
  return (
    <div className={className}>
      <M.Typography className={classes.title} variant="h6">
        {title}
        {description && (
          <M.Typography className={classes.description} variant="body2">
            {description}
          </M.Typography>
        )}
      </M.Typography>
      <div
        className={cx(classes.layout, {
          [classes.duplex]: layout === 2,
        })}
      >
        {values.map((value) => (
          <Field
            disabled={disabled}
            key={value.key}
            value={value}
            size="small"
            onChange={onChange}
            config={config}
          />
        ))}
      </div>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: t.spacing(2),
  },
  helperText: {
    marginBottom: t.spacing(2),
  },
  error: {
    marginBottom: t.spacing(2),
  },
  group: {
    '& + &': {
      marginTop: t.spacing(3),
    },
  },
}))

function parseGroupKey(key: keyof Config): keyof typeof I18N {
  if (key === 'ui.package_description.multiline') {
    return 'ui.package_description.all'
  }
  if (key === 'ui.blocks.qurator') {
    return 'ui.qurator'
  }
  if (key.match(/ui\.blocks\.meta\..*\.expanded/)) {
    return 'ui.blocks.meta.*.expanded'
  }
  const keyParts = key.split('.')
  if (keyParts.length > 2) {
    return keyParts.slice(0, -1).join('.') as keyof typeof I18N
  }
  return key as keyof typeof I18N
}

export default function BucketPreferences({
  className,
  disabled,
  error,
  initialValue,
  onChange,
}: QuiltConfigEditorProps) {
  const errors = React.useMemo(() => (error ? [error] : []), [error])

  const [config, setConfig] = React.useState(parse(initialValue || '', {}))
  const classes = useStyles()
  const grouped = React.useMemo(
    () =>
      Object.values(config).reduce(
        (memo, value) => {
          let groupKey = parseGroupKey(value.key)
          return {
            ...memo,
            [groupKey]: [...(memo[groupKey] || []), value],
          }
        },
        {} as Record<string, KeyedValue[]>,
      ),
    [config],
  )

  const handleChange = React.useCallback(
    (v: KeyedValue) => setConfig((c) => ({ ...c, [v.key]: v })),
    [],
  )

  React.useEffect(() => {
    onChange(stringify(config))
  }, [config, onChange])

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="body2" className={classes.helperText}>
        Configuration for Catalog UI: show and hide features, set default values. See{' '}
        <StyledLink
          href={`${docs}/quilt-platform-administrator/preferences`}
          target="_blank"
        >
          the docs
        </StyledLink>
      </M.Typography>

      {!!errors.length && (
        <JsonValidationErrors className={classes.error} error={errors} />
      )}

      {Object.entries(grouped).map(([id, values]) => (
        <Group
          className={classes.group}
          config={config}
          disabled={disabled}
          id={id as keyof typeof I18N}
          key={id}
          onChange={handleChange}
          values={values}
        />
      ))}
    </div>
  )
}
