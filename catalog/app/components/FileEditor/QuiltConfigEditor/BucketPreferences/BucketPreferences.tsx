import type { ErrorObject } from 'ajv'
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

function InputBoolean({
  className,
  disabled,
  onChange,
  size,
  value: { key, value },
}: FieldProps<TypedValue<boolean>>) {
  const handleChange = React.useCallback(
    (_e, checked: boolean) => onChange({ isDefault: false, key, value: checked }),
    [key, onChange],
  )
  return (
    <M.FormControl className={className}>
      <M.FormControlLabel
        control={<M.Checkbox checked={!!value} size={size} onChange={handleChange} />}
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

const useInputSourceBucketsStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
  },
}))

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
  const classes = useInputSourceBucketsStyles()
  const handleChange = React.useCallback(
    (_e, buckets: string[]) => onChange({ isDefault: false, key, value: buckets }),
    [key, onChange],
  )
  return (
    <Lab.Autocomplete
      className={cx(className, classes.root)}
      multiple
      onChange={handleChange}
      options={options}
      renderInput={(params) => <M.TextField {...params} placeholder="Allowed buckets" />}
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
  'ui.actions': 'Toggle buttons visibility',
  'ui.actions.copyPackage': '"PUSH TO BUCKET" on the package page',
  'ui.actions.createPackage':
    '"CREATE PACKAGE" on the package list and bucket listing pages',
  'ui.actions.deleteRevision': '"DELETE REVISION" menu item on the package page',
  'ui.actions.revisePackage': '"REVISE PACKAGE" on the package page',

  'ui.athena.defaultWorkgroup': 'Default workgroup for Athena queries',

  'ui.blocks': 'Toggle blocks visibility',
  'ui.blocks.gallery': 'Toggle galleries visibility',
  'ui.blocks.analytics': 'Toggle ANALYTICS section on the file page',
  'ui.blocks.browser': 'Toggle files listings on bucket and packages pages',
  'ui.blocks.code': 'Toggle CODE section',
  'ui.blocks.meta': 'Toggle METADATA section',
  'ui.blocks.qurator': 'Enable Qurator omni',

  'ui.blocks.meta.*.expanded': 'Auto-expand JSON blocks in Metadata section',
  'ui.blocks.meta.user_meta.expanded': 'Expand "User metadata"',
  'ui.blocks.meta.workflows.expanded': 'Expand "Workflow"',

  'ui.blocks.gallery.files': 'Images in the directory listing on bucket pages',
  'ui.blocks.gallery.overview': 'Images on the Bucket overview page',
  'ui.blocks.gallery.packages': 'Images in the directory listing on the package page',
  'ui.blocks.gallery.summarize':
    'Image galleries alongside those defined in quilt_summarize.json',

  'ui.nav': 'Toggle navigation items',
  'ui.nav.files': '"BUCKET" tab',
  'ui.nav.packages': '"PACKAGES" tab',
  'ui.nav.queries': '"QUERIES" tab',

  'ui.source_buckets': 'List of buckets allowed to be as source for packages',
  'ui.package_description': 'Package list appearance',
  'ui.package_description.multiline': 'Display `user_meta` on multiple lines',
}

function i18n(key: string): string {
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
  if (value.key === 'ui.package_description') {
    return (
      <InputPackageDescription
        {...props}
        value={value as KeyedValue<'ui.package_description'>}
      />
    )
  }

  if (value.key === 'ui.source_buckets') {
    return (
      <InputSourceBuckets {...props} value={value as KeyedValue<'ui.source_buckets'>} />
    )
  }

  if (value.key === 'ui.source_buckets.default') {
    return (
      <InputDefaultSourceBucket
        {...props}
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
    display: 'grid',
    gridColumnGap: t.spacing(2),
    gridRowGap: t.spacing(1),
  },
  group2Columns: {
    gridTemplateColumns: '1fr 1fr',
  },
  group3Columns: {
    gridTemplateColumns: '1fr 1fr 1fr',
  },
  groupTitle: {
    marginBottom: t.spacing(1),
  },
  groupWrapper: {
    '& + &': {
      marginTop: t.spacing(3),
    },
  },
}))

export default function BucketPreferences({
  className,
  disabled,
  error,
  initialValue,
  onChange,
}: QuiltConfigEditorProps) {
  const [errors /*, setErrors */] = React.useState<[Error] | ErrorObject[]>(
    error ? [error] : [],
  )

  const [config, setConfig] = React.useState(parse(initialValue || '', {}))
  const classes = useStyles()
  const grouped = React.useMemo(
    () =>
      Object.values(config).reduce(
        (memo, value) => {
          let groupKey: string = value.key
          const keyParts = value.key.split('.')
          if (keyParts.length > 2 && value.key !== 'ui.package_description') {
            groupKey = keyParts.slice(0, -1).join('.')
          }
          if (value.key.match(/ui\.blocks\.meta\..*\.expanded/)) {
            groupKey = 'ui.blocks.meta.*.expanded'
          }
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

      {Object.entries(grouped).map(([groupKey, groupValues]) => (
        <div key={groupKey} className={classes.groupWrapper}>
          {groupValues.length > 1 && (
            <M.Typography className={classes.groupTitle} variant="h6">
              {i18n(groupKey)}
            </M.Typography>
          )}
          <div
            className={cx(classes.group, {
              [classes.group2Columns]:
                groupValues.length > 1 && groupKey !== 'ui.package_description',
              [classes.group3Columns]: groupValues.length === 3 || groupValues.length > 5,
            })}
          >
            {groupValues.map((value) => (
              <Field
                disabled={disabled}
                key={value.key}
                value={value}
                size={groupValues.length === 1 ? 'medium' : 'small'}
                onChange={handleChange}
                config={config}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
