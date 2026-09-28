import * as React from 'react'
import { FileRejection, FileWithPath, useDropzone } from 'react-dropzone'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'

import {
  MAX_ICON_DATA_URL_LENGTH,
  cropToDataUrl,
  probeWithinPixelBudget,
} from './iconCrop'

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

// Case-insensitive, because BucketIcon decides what to render from the scheme the
// same way: a `DATA:` value it would draw as an image must not be treated here as
// a URL and cut to the URL length.
const isDataUrl = (v: string) => /^data:/i.test(v)

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
  gifNote: {
    marginBottom: 0,
    padding: t.spacing(0, 3),
  },
}))

interface CropDialogProps {
  file: FileWithPath
  // Carries the last encode failure out, so a refusal an admin has to act on
  // does not vanish with the dialog that reported it.
  onCancel: (reason?: string) => void
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

  // A ref rather than the `busy` state: two clicks in one frame both read the
  // state as false from the same render and both encode.
  const running = React.useRef(false)

  const confirm = React.useCallback(async () => {
    if (!src || !area || running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      onConfirm(await cropToDataUrl(src, area))
      // No state reset on success: onConfirm unmounts this dialog, and setting
      // state afterwards is an update on an unmounted component.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process image')
      setBusy(false)
      running.current = false
    }
  }, [area, onConfirm, src])

  return (
    <M.Dialog
      open
      onClose={busy ? undefined : () => onCancel(error ?? undefined)}
      fullWidth
      maxWidth="sm"
    >
      <M.DialogTitle>Crop icon</M.DialogTitle>
      {file.type === 'image/gif' && (
        <M.DialogContentText className={classes.gifNote}>
          The icon is a still image, so only this GIF's first frame is kept.
        </M.DialogContentText>
      )}
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
        <M.Button
          onClick={() => onCancel(error ?? undefined)}
          color="primary"
          disabled={busy}
        >
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
    // Both margins, matching the `margin="normal"` every sibling field carries:
    // top alone leaves this field 8px closer to Description than the rest.
    margin: t.spacing(2, 0, 1),
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
  field: {
    flexGrow: 1,
  },
  note: {
    marginTop: t.spacing(0.5),
  },
}))

type IconInputProps = RF.FieldRenderProps<string> & {
  // The bucket's name, not its title: it is the tint key every other surface
  // hashes, so the preview disc matches the row behind it. Undefined on the add
  // form, where no bucket is saved yet; the live `name` field stands in.
  bucketName?: string
  // Same shape Admin/Form's Field takes, so a validator key resolves to a sentence
  // here as it does on every sibling field.
  errors?: Record<string, React.ReactNode>
}

export default function IconInput({
  input,
  meta,
  bucketName,
  errors = {},
}: IconInputProps) {
  const classes = useStyles()
  // The live Title, so the initials track what is being typed rather than the last
  // saved value -- which on the add form does not exist yet.
  const title = RF.useField<string>('title', { subscription: { value: true } }).input
    .value
  // The add form's own Name field, so the preview wears the tint the bucket will
  // actually get: the hash avalanches, so keying off Title instead would run the
  // disc through unrelated colours per keystroke and settle on none of them.
  const liveName = RF.useField<string>('name', { subscription: { value: true } }).input
    .value
  const [file, setFile] = React.useState<FileWithPath | null>(null)
  const [rejected, setRejected] = React.useState<string | null>(null)
  const disabled = meta.submitting || meta.submitSucceeded

  // Which selection the pending probe belongs to. Probes take as long as the image
  // is big, so a slow first pick would otherwise resolve after a fast second one
  // and open the dialog on the file the admin had already replaced.
  const selection = React.useRef(0)

  // Screened before the dialog mounts: the cropper renders the file in an `<img>`,
  // which decodes the whole bitmap, so a budget checked after that point would run
  // once the memory had already gone.
  const onDrop = React.useCallback(async (files: FileWithPath[]) => {
    if (!files.length) return
    setRejected(null)
    selection.current += 1
    const seq = selection.current
    const url = URL.createObjectURL(files[0])
    try {
      const fits = await probeWithinPixelBudget(url)
      if (seq !== selection.current) return
      if (fits) setFile(files[0])
      else setRejected('Choose an image with fewer pixels')
    } catch {
      if (seq === selection.current) setRejected('Could not read that image')
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [])

  const onDropRejected = React.useCallback((rejections: FileRejection[]) => {
    // Retires a probe still running on an earlier pick, which would otherwise open
    // the dialog on that file while this rejection is on screen naming another.
    selection.current += 1
    // Name the constraint that actually failed: told "wrong format" after
    // dropping two correctly-typed files, an admin has no way to find the real one.
    const code = rejections[0]?.errors[0]?.code
    if (code === 'too-many-files') setRejected('Choose one image')
    else if (code === 'file-too-large')
      setRejected(`Choose an image under ${MAX_SOURCE_BYTES / 1024 / 1024}MB`)
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
  const uploaded = isDataUrl(value)

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
          {/* The root is `role="presentation"` and the preview disc has no text, so
              without this the focusable dropzone announces only its caption. */}
          <input
            {...getInputProps({
              'aria-label': 'Upload a bucket icon: PNG, JPEG, WebP or GIF',
            })}
          />
          <BucketIcon
            src={value || null}
            label={title}
            tintKey={bucketName || liveName || title}
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
            (fieldError &&
              (typeof fieldError === 'string'
                ? errors[fieldError] || fieldError
                : fieldError)) ||
            (uploaded
              ? 'Uploaded image. Drop another to replace it, or clear this to enter a URL.'
              : 'Drop an image to upload and crop it, or paste a URL.')
          }
          // A data: URI is thousands of characters, so it is described rather than
          // shown; read-only because a keystroke in a field showing a truncation
          // would replace the whole stored value with that one character.
          value={uploaded ? `Uploaded image (${value.length} characters)` : value}
          onChange={(e) => {
            if (uploaded) return
            // The drop message describes a file, not this field, so typing here
            // retires it rather than leaving red text under unrelated input.
            setRejected(null)
            const next = e.target.value.replace(/^\s+/, '')
            // A data: URI is refused rather than truncated: any cut leaves a value
            // that cannot decode but still reads as uploaded, which hides it behind
            // a description and locks the field against repairing it. A URL is safe
            // to cut -- it stays visible and editable.
            if (isDataUrl(next)) {
              if (next.length > MAX_ICON_DATA_URL_LENGTH) {
                setRejected('That image data is too long to store as an icon')
                return
              }
              input.onChange(next)
              return
            }
            input.onChange(next.slice(0, 1024))
          }}
          onBlur={(e) => {
            // Trimmed on commit rather than per keystroke, so a space stays
            // typable mid-value. Skipped while uploaded, where the field shows a
            // description of the value rather than the value.
            if (!uploaded) {
              const trimmed = e.target.value.trim()
              if (trimmed !== e.target.value) input.onChange(trimmed)
            }
            input.onBlur(e)
          }}
          onFocus={input.onFocus}
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
          InputProps={{
            readOnly: uploaded,
            endAdornment: value ? (
              <M.InputAdornment position="end">
                <M.IconButton
                  aria-label="Remove icon"
                  size="small"
                  disabled={disabled}
                  onClick={() => {
                    setRejected(null)
                    input.onChange('')
                  }}
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
        <CropDialog
          file={file}
          onCancel={(reason) => {
            setFile(null)
            if (reason) setRejected(reason)
          }}
          onConfirm={onConfirm}
        />
      )}
    </>
  )
}
