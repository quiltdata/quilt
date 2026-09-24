import * as React from 'react'
import { FileRejection, FileWithPath, useDropzone } from 'react-dropzone'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'

import { cropToDataUrl } from './iconCrop'

// What the canvas decoder handles and can re-encode, which is this path's only
// constraint: the crop never reaches S3, so the logo upload's IAM-pinned
// extension allowlist is not the same list. SVG is out because canvas cannot
// decode one without a same-origin document; an animated GIF is accepted but
// only its first frame survives the crop.
const ACCEPTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// A 96px square never needs megabytes of source. The cap is on the file rather
// than the decoded bitmap because decoding is what a huge image kills the tab
// doing, and only the file size is known before that.
const MAX_SOURCE_BYTES = 12 * 1024 * 1024

const useCropDialogStyles = M.makeStyles((t) => ({
  cropper: {
    background: t.palette.grey[900],
    height: 320,
    position: 'relative',
  },
  zoom: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
    padding: t.spacing(2, 3, 0),
  },
  error: {
    padding: t.spacing(0, 3),
  },
}))

interface CropDialogProps {
  file: FileWithPath
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}

function CropDialog({ file, onCancel, onConfirm }: CropDialogProps) {
  const classes = useCropDialogStyles()
  const [src, setSrc] = React.useState<string | null>(null)
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [area, setArea] = React.useState<Area | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onCropComplete = React.useCallback(
    (_area: Area, areaPixels: Area) => setArea(areaPixels),
    [],
  )

  const onZoom = React.useCallback(
    (_e: React.ChangeEvent<{}>, value: number | number[]) =>
      setZoom(Array.isArray(value) ? value[0] : value),
    [],
  )

  const confirm = React.useCallback(async () => {
    if (!src || !area || busy) return
    setBusy(true)
    setError(null)
    try {
      onConfirm(await cropToDataUrl(src, area))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process image')
      setBusy(false)
    }
  }, [area, busy, onConfirm, src])

  return (
    <M.Dialog open onClose={busy ? undefined : onCancel} fullWidth maxWidth="sm">
      <M.DialogTitle>Crop icon</M.DialogTitle>
      <div className={classes.cropper}>
        {src && (
          <Cropper
            image={src}
            aspect={1}
            crop={crop}
            zoom={zoom}
            maxZoom={5}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        )}
      </div>
      <div className={classes.zoom}>
        <M.Typography variant="body2" color="textSecondary">
          Zoom
        </M.Typography>
        <M.Slider
          aria-label="Zoom"
          value={zoom}
          min={1}
          max={5}
          step={0.01}
          onChange={onZoom}
          disabled={busy}
        />
      </div>
      {error && (
        <M.FormHelperText error className={classes.error}>
          {error}
        </M.FormHelperText>
      )}
      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary" disabled={busy}>
          Cancel
        </M.Button>
        <M.Button
          onClick={confirm}
          color="primary"
          variant="contained"
          disabled={busy || !area}
        >
          Use icon
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    gap: t.spacing(2),
    marginTop: t.spacing(2),
  },
  dropzone: {
    alignItems: 'center',
    border: `1px dashed ${t.palette.divider}`,
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
    justifyContent: 'center',
    padding: t.spacing(1, 2),
    textAlign: 'center',
    '&:hover, &$active': {
      borderColor: t.palette.primary.main,
    },
    '&:focus-visible': {
      borderColor: t.palette.primary.main,
      outline: `2px solid ${t.palette.primary.light}`,
    },
  },
  active: {},
  preview: {
    height: 44,
    width: 44,
  },
  field: {
    flexGrow: 1,
  },
  note: {
    marginTop: t.spacing(0.5),
  },
}))

type IconInputProps = RF.FieldRenderProps<string> & {
  // The bucket's name, not its title: it is the tint key every other surface
  // hashes, so the preview disc matches the row behind it. Absent on the add form,
  // where there is no bucket yet.
  bucketName?: string
}

export default function IconInput({ input, meta, bucketName }: IconInputProps) {
  const classes = useStyles()
  // The live Title, so the initials track what is being typed rather than the last
  // saved value -- which on the add form does not exist yet.
  const title = RF.useField<string>('title', { subscription: { value: true } }).input
    .value
  const [file, setFile] = React.useState<FileWithPath | null>(null)
  const [rejected, setRejected] = React.useState<string | null>(null)
  const disabled = meta.submitting || meta.submitSucceeded

  const onDrop = React.useCallback((files: FileWithPath[]) => {
    if (!files.length) return
    setRejected(null)
    setFile(files[0])
  }, [])

  const onDropRejected = React.useCallback((rejections: FileRejection[]) => {
    // Name the constraint that actually failed: told "wrong format" after
    // dropping two correctly-typed files, an admin has no way to find the real one.
    const code = rejections[0]?.errors[0]?.code
    if (code === 'too-many-files') setRejected('Choose one image')
    else if (code === 'file-too-large') setRejected('Choose an image under 12MB')
    else setRejected('Choose a PNG, JPEG, WebP or GIF image')
  }, [])

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: Object.fromEntries(ACCEPTED_IMAGE_MIME_TYPES.map((t) => [t, []])),
    disabled,
    maxFiles: 1,
    maxSize: MAX_SOURCE_BYTES,
    onDrop,
    onDropRejected,
  })

  const onConfirm = React.useCallback(
    (dataUrl: string) => {
      input.onChange(dataUrl)
      setFile(null)
    },
    [input],
  )

  // react-final-form hands an untouched field `undefined` until it is registered.
  const value: string = input.value || ''
  const uploaded = value.startsWith('data:')

  // Same rule Admin/Form's Field applies, so a validator or a server error mapped
  // to this field surfaces here as it does on every sibling field.
  const fieldError =
    meta.submitFailed && (meta.error || (!meta.dirtySinceLastSubmit && meta.submitError))

  return (
    <>
      <div className={classes.root}>
        <div
          {...getRootProps({
            className: `${classes.dropzone}${isDragActive ? ` ${classes.active}` : ''}`,
          })}
        >
          <input {...getInputProps()} />
          <BucketIcon
            className={classes.preview}
            src={value || null}
            label={title}
            tintKey={bucketName || title}
            size={44}
          />
          <M.Typography variant="caption" color="textSecondary">
            Drop or choose
          </M.Typography>
        </div>
        <M.TextField
          className={classes.field}
          label="Icon URL (optional)"
          placeholder="e.g. https://some-cdn.com/icon.png"
          error={!!fieldError}
          helperText={
            fieldError ||
            (uploaded
              ? 'Uploaded image. Drop another to replace it, or clear this to enter a URL.'
              : 'Drop an image to upload and crop it, or paste a URL.')
          }
          value={uploaded ? '' : value}
          onChange={(e) => input.onChange(e.target.value.trim().slice(0, 1024))}
          onBlur={input.onBlur}
          onFocus={input.onFocus}
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
          InputProps={{
            endAdornment: value ? (
              <M.InputAdornment position="end">
                <M.IconButton
                  aria-label="Remove icon"
                  size="small"
                  disabled={disabled}
                  onClick={() => input.onChange('')}
                >
                  <M.Icon fontSize="small">clear</M.Icon>
                </M.IconButton>
              </M.InputAdornment>
            ) : null,
          }}
          fullWidth
        />
      </div>
      {rejected && (
        <M.FormHelperText error className={classes.note}>
          {rejected}
        </M.FormHelperText>
      )}
      {file && (
        <CropDialog file={file} onCancel={() => setFile(null)} onConfirm={onConfirm} />
      )}
    </>
  )
}
