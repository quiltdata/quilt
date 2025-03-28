import cx from 'classnames'
import React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonValidationErrors from 'components/JsonValidationErrors'
import { docs } from 'constants/urls'
import * as BucketConfig from 'utils/BucketConfig'
import StyledLink from 'utils/StyledLink'
import { JsonInvalidAgainstSchema } from 'utils/error'

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
        label={fieldI18n(key)}
      />
    </M.FormControl>
  )
}

function AthenaDefaultWorkgroup({
  className,
  onChange,
  value: { key, value },
  ...props
}: FieldProps<KeyedValue<'ui.athena.defaultWorkgroup'>>) {
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
      label={fieldI18n(key)}
      onChange={handleChange}
      placeholder="e.g. primary"
      value={value}
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
  const options = config['ui.sourceBuckets'].value
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
          placeholder="e.g. s3://quilt-example"
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

const I18N_FIELDS = {
  'ui.actions.copyPackage': '"PUSH TO BUCKET" on the package page',
  'ui.actions.createPackage':
    '"CREATE PACKAGE" on the package list and bucket listing pages',
  'ui.actions.deleteRevision': '"DELETE REVISION" menu item on the package page',
  'ui.actions.downloadObject': 'Download buttons under the "BUCKET" tab',
  'ui.actions.downloadPackage': 'Download buttons under the "PACKAGES" tab',
  'ui.actions.revisePackage': '"REVISE PACKAGE" on the package page',
  'ui.actions.writeFile': 'Buttons to create or edit files',

  'ui.athena.defaultWorkgroup': 'Default workgroup for Athena queries',

  'ui.blocks.analytics': '"ANALYTICS" on the file page',
  'ui.blocks.browser': 'File listings on bucket and packages pages',
  'ui.blocks.code': '"CODE"',
  'ui.blocks.meta': '"METADATA"',
  'ui.blocks.qurator': '"Qurator Assistance" icon button on object and package pages',

  'ui.blocks.meta.user_meta.expanded': 'Auto-expand "User Metadata" field',
  'ui.blocks.meta.workflows.expanded': 'Auto-expand "Workflow" field',

  'ui.blocks.gallery.files': 'Images in the directory listing on bucket pages',
  'ui.blocks.gallery.overview': 'Images on the Bucket overview page',
  'ui.blocks.gallery.packages': 'Images in the directory listing on the package page',
  'ui.blocks.gallery.summarize':
    'Image galleries alongside those defined in quilt_summarize.json',

  'ui.nav.files': '"BUCKET"',
  'ui.nav.workflows': '"WORKFLOWS"',
  'ui.nav.packages': '"PACKAGES"',
  'ui.nav.queries': '"QUERIES"',

  'ui.package_description_multiline':
    'Display `user_meta` fields on separate lines, when enabled. Visibility of the `user_meta` can be configured in the next section.',
}

const GROUPS = {
  // NOTE: Combine all meta.*.expanded keys into one group
  'custom_group.expanded_meta': {
    description:
      'Display settings for JSON blocks in Metadata section on object and package pages',
    sortIndex: 0,
    title: 'Metadata Display',
  },

  'ui.athena': {
    description: '',
    sortIndex: 30,
    title: 'Athena',
  },
  'ui.nav': {
    description: 'Show tabs at the top of the bucket pages',
    sortIndex: 0,
    title: 'Navigation items',
  },
  'ui.blocks': {
    description: 'Show UI sections',
    sortIndex: 0,
    title: 'Sections',
  },
  'ui.blocks.gallery': {
    description: 'Show image galleries',
    sortIndex: 0,
    title: 'Galleries',
  },
  'ui.actions': {
    description: 'Show buttons and menu items',
    sortIndex: 0,
    title: 'Actions',
  },
  'ui.package_description_multiline': {
    description: '',
    sortIndex: 10,
    title: 'Package List: common display settings',
  },
  'ui.package_description': {
    description: 'Selectively apply display settings to matching packages',
    sortIndex: 20,
    title: 'Package List: selective display settings',
  },
  'ui.sourceBuckets': {
    description:
      'Buckets available in package creation and revision dialogs under "ADD FILES FROM BUCKET"',
    sortIndex: 0,
    title: 'Source buckets for packages',
  },
}

type GroupKey = keyof typeof GROUPS

function fieldI18n(key: string): string {
  return I18N_FIELDS[key as keyof typeof I18N_FIELDS] ?? key
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

  if (value.key === 'ui.sourceBuckets') {
    return (
      <InputSourceBuckets
        {...props}
        className={cx(props.className, classes.margin)}
        value={value as KeyedValue<'ui.sourceBuckets'>}
      />
    )
  }

  if (value.key === 'ui.defaultSourceBucket') {
    return (
      <InputDefaultSourceBucket
        {...props}
        className={cx(props.className, classes.margin)}
        config={config}
        value={value as KeyedValue<'ui.defaultSourceBucket'>}
      />
    )
  }

  if (value.key === 'ui.athena.defaultWorkgroup') {
    return <AthenaDefaultWorkgroup {...props} value={value as TypedValue<string>} />
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
    gridColumnGap: t.spacing(2),
    gridRowGap: t.spacing(1),
  },
}))

interface GroupProps {
  className: string
  config: Config
  disabled?: boolean
  id: GroupKey
  onChange: (v: KeyedValue) => void
  values: Config[keyof Config][]
}

function Group({ className, config, disabled, id, onChange, values }: GroupProps) {
  const classes = useGroupStyles()
  const i18n = GROUPS[id]
  const layout = React.useMemo(() => {
    switch (id) {
      case 'custom_group.expanded_meta':
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
        {i18n.title}
        {i18n.description && (
          <M.Typography className={classes.description} variant="body2">
            {i18n.description}
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

// Group keys so 'ui.a.b', and 'ui.a.b' are in the same 'ui.a' group
// Enclose single root keys into one-field groups
// Also, move some config keys into other groups
//       or combine some keys into a new group
function parseGroupKey(key: keyof Config): GroupKey {
  if (key === 'ui.blocks.qurator') {
    // NOTE: Move into actions
    return 'ui.actions'
  }
  if (key === 'ui.defaultSourceBucket') {
    // NOTE: render sourceBuckets and defaultSourceBucket in the same group
    return 'ui.sourceBuckets'
  }
  if (key.match(/ui\.blocks\.meta\..*\.expanded/)) {
    // NOTE: Combine into a group
    return 'custom_group.expanded_meta'
  }
  const keyParts = key.split('.')
  if (keyParts.length > 2) {
    return keyParts.slice(0, -1).join('.') as GroupKey
  }
  return key as GroupKey
}

export default function BucketPreferences({
  className,
  disabled,
  error,
  initialValue,
  onChange,
}: QuiltConfigEditorProps) {
  const [errors, setErrors] = React.useState(() => (error ? [error] : []))

  const [config, setConfig] = React.useState(parse(initialValue || '', {}))
  const classes = useStyles()
  const grouped = React.useMemo(
    () =>
      Object.values(config).reduce(
        (memo, value) => {
          const groupKey = parseGroupKey(value.key)
          return {
            ...memo,
            [groupKey]: [...(memo[groupKey] || []), value],
          }
        },
        {} as Record<GroupKey, KeyedValue[]>,
      ),
    [config],
  )

  const handleChange = React.useCallback(
    (v: KeyedValue) => setConfig((c) => ({ ...c, [v.key]: v })),
    [],
  )

  React.useEffect(() => {
    try {
      onChange(stringify(config))
    } catch (err) {
      if (err instanceof JsonInvalidAgainstSchema) setErrors(err.errors)
      setErrors(err instanceof Error ? [err] : [new Error(`${err}`)])
    }
  }, [config, onChange])

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="body2" className={classes.helperText}>
        Per-bucket Catalog UI configuration: show and hide features, set default values.{' '}
        <StyledLink
          href={`${docs}/quilt-platform-administrator/preferences`}
          target="_blank"
        >
          Learn more
        </StyledLink>
      </M.Typography>

      {!!errors.length && (
        <JsonValidationErrors className={classes.error} error={errors} />
      )}

      {Object.entries(grouped)
        .toSorted(
          ([idA], [idB]) =>
            GROUPS[idA as GroupKey].sortIndex - GROUPS[idB as GroupKey].sortIndex,
        )
        .map(([id, values]) => (
          <Group
            className={classes.group}
            config={config}
            disabled={disabled}
            id={id as GroupKey}
            key={id}
            onChange={handleChange}
            values={values}
          />
        ))}
    </div>
  )
}
