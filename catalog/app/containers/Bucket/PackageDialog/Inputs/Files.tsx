import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as BucketPreferences from 'utils/BucketPreferences'

import * as State from '../state'
import { FilesInput } from '../FilesInput'
import { FilesInputSkeleton } from '../Skeleton'

const useInputFilesStyles = M.makeStyles((t) => ({
  root: {
    height: '100%',
    overflowY: 'auto',
  },
  error: {
    height: `calc(90% - ${t.spacing()}px)`,
  },
}))

export default function InputFiles() {
  const classes = useInputFilesStyles()
  const {
    formStatus,
    entriesSchema: schema,
    progress,
    values: {
      files: { initial, status, value, onChange },
    },
  } = State.use()
  const { prefs } = BucketPreferences.use()

  if (schema._tag === 'loading') return <FilesInputSkeleton className={classes.root} />

  return BucketPreferences.Result.match(
    {
      Ok: () => (
        <FilesInput
          disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
          className={cx(classes.root, { [classes.error]: status._tag === 'error' })}
          value={value}
          initial={initial}
          onChange={onChange}
          error={status._tag === 'error' ? status.error : undefined}
          errors={status._tag === 'error' ? status.errors : undefined}
          title="Files"
          totalProgress={progress}
        />
      ),
      Pending: () => <FilesInputSkeleton className={classes.root} />,
      Init: () => null,
    },
    prefs,
  )
}
