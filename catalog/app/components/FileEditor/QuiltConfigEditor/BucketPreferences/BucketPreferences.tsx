import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import schema from 'schemas/bucketConfig.yml.json'

import JsonEditor from 'components/JsonEditor'
import JsonValidationErrors from 'components/JsonValidationErrors'
import * as BucketConfig from 'utils/BucketConfig'
// import type { PackagePreferencesInput } from 'utils/BucketPreferences/BucketPreferences'

import type { QuiltConfigEditorProps } from '../QuiltConfigEditor'

import { parse, stringify } from './State'
import type { Config, Value } from './State'

// const usePackageDescriptionItemStyles = M.makeStyles((t) => ({
//   root: {
//     display: 'grid',
//     gridTemplateRows: '1fr 1fr 1fr',
//     rowGap: t.spacing(1),
//   },
// }))
//
// interface PackageDescriptionItemProps {
//   disabled?: boolean
//   onChange: (key: string, v: PackagePreferencesInput) => void
//   onRename: (oldKey: string, newKey: string) => void
//   regexp: string
//   size: 'medium' | 'small'
//   value: PackagePreferencesInput
// }
//
// function PackageDescriptionItem({
//   disabled,
//   onChange,
//   onRename,
//   regexp: initialRegexp,
//   size,
//   value: { message: initialMessage, user_meta: initialUserMeta },
// }: PackageDescriptionItemProps) {
//   const classes = usePackageDescriptionItemStyles()
//
//   const [regexp, setRegexp] = React.useState(initialRegexp)
//   const [message, setMessage] = React.useState(initialMessage || false)
//   const [userMeta, setUserMeta] = React.useState(initialUserMeta || [])
//
//   const handleRegexp: React.ChangeEventHandler<HTMLInputElement> = React.useCallback(
//     (event) => {
//       setRegexp(event.target.value)
//       onRename(initialRegexp, event.target.value)
//     },
//     [initialRegexp, onRename],
//   )
//
//   const handleUserMeta = React.useCallback(
//     (_e, labels: string[]) => {
//       setUserMeta(labels)
//       onChange(initialRegexp, {
//         message,
//         user_meta: labels,
//       })
//     },
//     [onChange, initialRegexp, message],
//   )
//
//   const handleMessage = React.useCallback(
//     (_e, checked: boolean) => {
//       setMessage(checked)
//       onChange(initialRegexp, {
//         message: checked,
//         user_meta: userMeta,
//       })
//     },
//     [onChange, initialRegexp, userMeta],
//   )
//
//   return (
//     <div className={classes.root}>
//       <M.TextField
//         label="RegExp for the package handle"
//         onChange={handleRegexp}
//         size={size}
//         value={regexp}
//       />
//       <M.FormControl>
//         <M.FormControlLabel
//           control={
//             <M.Checkbox checked={message || false} size={size} onChange={handleMessage} />
//           }
//           disabled={disabled}
//           label="Show the last commit message in the package list"
//         />
//       </M.FormControl>
//       <Lab.Autocomplete
//         multiple
//         freeSolo
//         options={userMeta?.map((x) => x) || []}
//         renderInput={(params) => (
//           <M.TextField {...params} placeholder="Keys from `user_meta`" />
//         )}
//         onChange={handleUserMeta}
//         size={size}
//       />
//     </div>
//   )
// }

const usePackageDescriptionStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  item: {
    display: 'grid',
    gridTemplateRows: '1fr 1fr 1fr',
    rowGap: t.spacing(1),
  },
}))

interface PackageDescriptionProps extends Omit<FieldProps, 'value' | 'onChange'> {
  value: Value<'ui.package_description'>
  onChange: (v: Value<'ui.package_description'>) => void
}

function PackageDescription({
  className,
  disabled,
  value,
  onChange,
}: PackageDescriptionProps) {
  const classes = usePackageDescriptionStyles()

  const handleJson = React.useCallback(
    (json) => {
      onChange({
        isDefault: false,
        key: value.key,
        value: json,
      })
    },
    [onChange, value],
  )

  // const handleKeyChange = React.useCallback(
  //   (oldKey: string, newKey: string) => {
  //     const { [oldKey]: val, ...rest } = value.value
  //     onChange({
  //       isDefault: false,
  //       key: value.key,
  //       value: {
  //         ...rest,
  //         [newKey]: val,
  //       },
  //     })
  //   },
  //   [onChange, value],
  // )
  // const handleValueChange = React.useCallback(
  //   (key: string, val: PackagePreferencesInput) => {
  //     onChange({
  //       isDefault: false,
  //       key: value.key,
  //       value: {
  //         ...value.value,
  //         [key]: val,
  //       },
  //     })
  //   },
  //   [onChange, value],
  // )

  return (
    <div className={cx(classes.root, className)}>
      <JsonEditor
        disabled={disabled}
        errors={[]}
        onChange={handleJson}
        schema={schema.properties.ui.properties.package_description}
        value={value.value}
      />

      {/*Object.entries(value.value).map(([k, v]) => (
        <PackageDescriptionItem
          disabled={disabled}
          key={k}
          regexp={k}
          value={v}
          size={size}
          onRename={handleKeyChange}
          onChange={handleValueChange}
        />
      ))*/}
    </div>
  )
}

const I18N = {
  'ui.actions': 'Toggle buttons visibility',
  'ui.actions.copyPackage': '"PUSH TO BUCKET" on the package page',
  'ui.actions.createPackage':
    '"CREATE PACKAGE" on the packages list and bucket listing pages',
  'ui.actions.deleteRevision': '"DELETE REVISION" item menu on the package page',
  'ui.actions.revisePackage': '"REVISE PACKAGE" on the package page',

  'ui.athena.defaultWorkgroup': 'Default workgroup for Athena queries',

  'ui.blocks': 'Toggle blocks visibility',
  'ui.blocks.gallery': 'Toggle galleries visibility',
  'ui.blocks.analytics': 'Toggle ANALYTICS section on the file page',
  'ui.blocks.browser': 'Toggle files listings on bucket and packages pages',
  'ui.blocks.code': 'Toggle CODE section',
  'ui.blocks.meta': 'Toggle METADATA section',
  'ui.blocks.qurator': 'Enable Qurator omni',

  'ui.blocks.meta.user_meta.expanded': 'Expand "User metadata" in METADATA section',
  'ui.blocks.meta.workflows.expanded': 'Expand "Workflow" in METADATA section',

  'ui.blocks.gallery.files': 'Images on the directory listing',
  'ui.blocks.gallery.overview': 'Images on the Bucket overview page',
  'ui.blocks.gallery.packages': 'Images in the directory listing on the package page',
  'ui.blocks.gallery.summarize': 'Image galleries alongside defined quilt_summarize.json',

  'ui.nav': 'Toggle navigation items',
  'ui.nav.files': '"BUCKET" tab',
  'ui.nav.packages': '"PACKAGES" tab',
  'ui.nav.queries': '"QUERIES" tab',

  'ui.source_buckets': 'List of buckets allowed to be as source for packages',
  'ui.package_description': 'Configure the packages list appearance',
  'ui.package_description.multiline':
    'Make package description in the packages list multiline',
}

function i18n(key: string): string {
  return I18N[key as keyof typeof I18N] ?? key
}

const sys = {
  'ui.actions.copyPackage': true,
  'ui.actions.createPackage': true,
  'ui.actions.deleteRevision': false,
  'ui.actions.revisePackage': true,

  'ui.athena.defaultWorkgroup': '',

  'ui.blocks.analytics': true,
  'ui.blocks.browser': true,
  'ui.blocks.code': true,

  'ui.blocks.meta': true,
  'ui.blocks.meta.user_meta.expanded': false,
  'ui.blocks.meta.workflows.expanded': false,

  'ui.blocks.gallery.files': true,
  'ui.blocks.gallery.overview': true,
  'ui.blocks.gallery.packages': true,
  'ui.blocks.gallery.summarize': true,

  'ui.blocks.qurator': true,

  'ui.nav.files': true,
  'ui.nav.packages': true,
  'ui.nav.queries': true,

  'ui.package_description': {
    '.*': {
      message: true as const,
      user_meta: [] as ReadonlyArray<string>,
    },
  },
  'ui.package_description.multiline': false,

  'ui.source_buckets': [],
  'ui.source_buckets.default': '',
}

const useFieldStyles = M.makeStyles((t) => ({
  autocomplete: {
    marginTop: t.spacing(2),
  },
  default: {
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
}))

interface FieldProps {
  className: string
  disabled?: boolean
  value: Value
  size: 'small' | 'medium'
  onChange: (v: Value) => void
  config: Config
}

function Field({
  className,
  disabled,
  size,
  value: { isDefault, key, value },
  onChange,
  config,
}: FieldProps) {
  const classes = useFieldStyles()
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  if (key === 'ui.package_description') {
    return (
      <PackageDescription
        {...{
          className,
          config,
          disabled,
          onChange,
          size,
          value: { isDefault, key, value } as Value<'ui.package_description'>,
        }}
      />
    )
  }

  if (key === 'ui.source_buckets') {
    return (
      <Lab.Autocomplete
        className={cx(className, classes.autocomplete)}
        disabled={disabled}
        multiple
        onChange={(_e, buckets) => onChange({ isDefault: false, key, value: buckets })}
        options={(bucketConfigs || []).map((b) => b.name)}
        renderInput={(params) => <M.TextField {...params} placeholder="Source buckets" />}
        size={size}
        value={value as string[]}
      />
    )
  }

  if (key === 'ui.source_buckets.default') {
    const options = config['ui.source_buckets'].value
    return (
      <M.FormControl
        className={cx(isDefault && classes.default, className)}
        fullWidth
        size={size}
      >
        <M.InputLabel>Default source bucket</M.InputLabel>
        <M.Select
          value={value || options[0]}
          onChange={(event) =>
            onChange({ isDefault: false, value: event.target.value as string, key })
          }
        >
          {options.map((bucket) => (
            <M.MenuItem key={bucket} value={bucket}>
              {bucket}
            </M.MenuItem>
          ))}
        </M.Select>
      </M.FormControl>
    )
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <M.TextField
        className={className}
        disabled={disabled}
        label={i18n(key)}
        placeholder={isDefault ? value.toString() : ''}
        size={size}
        value={isDefault ? '' : value}
        onChange={(event) =>
          onChange({ isDefault: false, key, value: event.target.value })
        }
      />
    )
  }

  if (typeof value === 'boolean') {
    return (
      <M.FormControl className={className}>
        <M.FormControlLabel
          control={
            <M.Checkbox
              className={cx(isDefault && classes.default)}
              checked={value}
              size={size}
              onChange={(_e, checked) =>
                onChange({ isDefault: false, key, value: checked })
              }
            />
          }
          disabled={disabled}
          label={i18n(key)}
        />
      </M.FormControl>
    )
  }

  return null
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: t.spacing(2),
  },
  error: {
    marginBottom: t.spacing(2),
  },
  field: {},
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

export default function QuiltSummarize({
  className,
  disabled,
  error,
  initialValue,
  onChange,
}: QuiltConfigEditorProps) {
  const [errors /*, setErrors */] = React.useState<[Error] | ErrorObject[]>(
    error ? [error] : [],
  )

  const [config, setConfig] = React.useState(parse(initialValue || '', sys, {}))
  const classes = useStyles()
  const grouped = React.useMemo(
    () =>
      Object.values(config).reduce(
        (memo, value) => {
          const keyParts = value.key.split('.')
          const groupKey =
            keyParts.length > 2 ? keyParts.slice(0, -1).join('.') : value.key
          return {
            ...memo,
            [groupKey]: [...(memo[groupKey] || []), value],
          }
        },
        {} as Record<string, Value[]>,
      ),
    [config],
  )

  const handleChange = React.useCallback(
    (v: Value) => setConfig((c) => ({ ...c, [v.key]: v })),
    [],
  )

  React.useEffect(() => {
    onChange(stringify(config))
  }, [config, onChange])

  return (
    <div className={cx(classes.root, className)}>
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
                className={classes.field}
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
