import * as React from 'react'
import * as M from '@material-ui/core'

import * as S3Tags from 'utils/s3Tags'
import type { JsonRecord } from 'utils/types'

import { getMetaValue } from '../../requests'
import type { SchemaStatus } from '../State/schema'
import type { S3TagsConfigState } from '../State/s3Tags'

const useStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
  },
  key: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  muted: {
    color: t.palette.text.secondary,
  },
}))

interface S3TagsPreviewProps {
  config: S3TagsConfigState
  meta: JsonRecord | undefined
  schema: SchemaStatus
}

export default function S3TagsPreview({ config, meta, schema }: S3TagsPreviewProps) {
  const classes = useStyles()
  const projected = React.useMemo(() => {
    if (!config || config instanceof Error) return []
    // Same value the push sends: schema defaults applied.
    const value = getMetaValue(meta, schema._tag === 'ready' ? schema.schema : undefined)
    return S3Tags.project(config, value)
  }, [config, meta, schema])
  if (config instanceof Error) {
    return (
      <M.Typography className={classes.root} variant="body2" color="error">
        S3 tags are not written: {config.message}
      </M.Typography>
    )
  }
  if (!projected.length) return null
  return (
    <div className={classes.root}>
      <M.Typography variant="subtitle2">S3 object tags</M.Typography>
      <M.Typography variant="caption" className={classes.muted}>
        This bucket writes these metadata fields as S3 tags on the package's files.
      </M.Typography>
      <M.Table size="small">
        <M.TableBody>
          {projected.map(({ key, pointer, value, error }) => (
            <M.TableRow key={key}>
              <M.TableCell className={classes.key}>{key}</M.TableCell>
              <M.TableCell className={classes.muted}>{pointer}</M.TableCell>
              <M.TableCell>
                {error ? (
                  <M.Typography variant="body2" color="error">
                    Not written: {error}
                  </M.Typography>
                ) : (
                  (value ?? <span className={classes.muted}>Not set, tag removed</span>)
                )}
              </M.TableCell>
            </M.TableRow>
          ))}
        </M.TableBody>
      </M.Table>
    </div>
  )
}
