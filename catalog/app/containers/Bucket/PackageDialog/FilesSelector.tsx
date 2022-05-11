import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

const PROGRESS_EMPTY = { total: 0, loaded: 0, percent: 0 }

import * as Types from 'utils/types'
import {
  Checkbox,
  Contents,
  ContentsContainer,
  Dir,
  File,
  FilesContainer,
  Header,
  HeaderTitle,
  Lock,
  Root,
} from './FilesInput'

export const EMPTY_SELECTION = 'emptySelection'

export const validateNonEmptySelection = (state: FilesSelectorState) => {
  if (state.every(R.propEq('selected', false))) return EMPTY_SELECTION
  return undefined
}

interface FilesSelectorEntry {
  type: 'dir' | 'file'
  name: string
  selected: boolean
  size?: number
  meta?: Types.JsonRecord
}

export type FilesSelectorState = FilesSelectorEntry[]

interface FilesSelectorProps {
  input: {
    value: FilesSelectorState
    onChange: (value: FilesSelectorState) => void
  }
  className?: string
  disabled?: boolean
  errors?: Record<string, React.ReactNode>
  meta: {
    submitting: boolean
    submitSucceeded: boolean
    submitFailed: boolean
    dirty: boolean
    error?: string
    initial: FilesSelectorState
  }
  title: React.ReactNode
  truncated?: boolean
}

export function FilesSelector({
  input: { value, onChange },
  className,
  disabled = false,
  errors = {},
  meta,
  title,
  truncated = false,
}: FilesSelectorProps) {
  const submitting = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const selected = React.useMemo(
    () => value.reduce((m, i) => (i.selected ? m + 1 : m), 0),
    [value],
  )

  const toggleAll = React.useCallback(() => {
    onChange(value.map(R.assoc('selected', selected < value.length)))
  }, [onChange, value, selected])

  const toggleItem = React.useCallback(
    (index: number, checked: boolean) => {
      onChange(R.adjust(index, R.mergeLeft({ selected: checked }), value))
    },
    [onChange, value],
  )

  return (
    <Root className={className}>
      <Header>
        <HeaderTitle
          state={
            submitting || disabled // eslint-disable-line no-nested-ternary
              ? 'disabled'
              : error // eslint-disable-line no-nested-ternary
              ? 'error'
              : truncated
              ? 'warn'
              : undefined
          }
        >
          {title}
          {truncated && (
            // TODO: adjust copy
            <M.Tooltip title="Only the first 1000 items are shown, but the folder contains more">
              <M.Icon style={{ marginLeft: 6 }} fontSize="small">
                error_outline
              </M.Icon>
            </M.Tooltip>
          )}
        </HeaderTitle>
        <M.Box flexGrow={1} />
        {value.length > 0 && (
          <M.Button
            onClick={toggleAll}
            disabled={disabled || submitting}
            size="small"
            endIcon={
              <M.Icon fontSize="small">
                {selected === value.length // eslint-disable-line no-nested-ternary
                  ? 'check_box'
                  : !selected
                  ? 'check_box_outline_blank'
                  : 'indeterminate_check_box_icon'}
              </M.Icon>
            }
          >
            Select {selected < value.length ? 'all' : 'none'}
          </M.Button>
        )}
      </Header>

      <ContentsContainer>
        <Contents error={!!error} warn={truncated}>
          {value.length ? (
            <FilesContainer noBorder>
              {value.map(({ type, name, selected: sel, size }, index) =>
                type === 'dir' ? (
                  <Dir
                    key={`dir:${name}`}
                    name={name}
                    checkbox={
                      <Checkbox
                        checked={sel}
                        onChange={(_e, checked) => toggleItem(index, checked)}
                      />
                    }
                    data-name={name}
                    faint={!sel}
                  />
                ) : (
                  <File
                    key={`file:${name}`}
                    name={name}
                    size={size}
                    checkbox={
                      <Checkbox
                        checked={sel}
                        onChange={(_e, checked) => toggleItem(index, checked)}
                      />
                    }
                    data-name={name}
                    faint={!sel}
                    interactive
                  />
                ),
              )}
            </FilesContainer>
          ) : (
            // TODO: adjust copy
            <M.Box
              display="flex"
              flexGrow={1}
              alignItems="center"
              justifyContent="center"
            >
              <M.Typography align="center" color={error ? 'error' : undefined}>
                Current directory is empty
              </M.Typography>
            </M.Box>
          )}
          {submitting && <Lock progress={PROGRESS_EMPTY} />}
        </Contents>
      </ContentsContainer>

      {!!error && (
        <M.FormHelperText error margin="dense">
          {errors[error] || error}
        </M.FormHelperText>
      )}
    </Root>
  )
}
