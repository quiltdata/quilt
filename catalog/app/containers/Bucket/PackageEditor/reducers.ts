import * as R from 'ramda'

import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { L } from 'components/Form/Package/types'
import type { Workflow as WorkflowStruct } from 'utils/workflows'

// import { workflowsList } from "../stories/PackageDialog/Workflow";
const workflowsList: WorkflowStruct[] = []

import { State } from './state'

export type Reducer = (s: State) => State

const bucket = {
  setValue: (value: BucketConfig | null): Reducer =>
    R.set(R.lensPath(['bucket', 'value']), value),
  setSuccessors: (value: BucketConfig[] | typeof L | Error): Reducer =>
    R.set(R.lensPath(['bucket', 'successors']), value),
  setBuckets: (value: BucketConfig[] | typeof L | Error): Reducer =>
    R.set(R.lensPath(['bucket', 'buckets']), value),
  startFetching: (): Reducer =>
    R.pipe(
      R.set(R.lensPath(['name']), L),
      R.set(R.lensPath(['message']), L),
      R.set(R.lensPath(['workflow']), L),
    ),
  fetched: (): Reducer =>
    R.pipe(
      R.set(R.lensPath(['name']), { value: '' }),
      R.set(R.lensPath(['message']), { value: '' }),
      R.set(R.lensPath(['workflow']), {
        value: null,
        workflows: workflowsList,
      }),
    ),
}

const message = {
  setValue: (value: string): Reducer => R.set(R.lensPath(['message', 'value']), value),
  setErrors: (errors?: Error[] | typeof L): Reducer =>
    R.set(R.lensPath(['message', 'errors']), errors),
}

const name = {
  setValue: (value: string): Reducer => R.set(R.lensPath(['name', 'value']), value),
  setErrors: (errors?: Error[] | typeof L): Reducer =>
    R.set(R.lensPath(['name', 'errors']), errors),
}

const workflow = {
  setValue: (value: WorkflowStruct | null): Reducer =>
    R.set(R.lensPath(['workflow', 'value']), value),
  startFetching: (): Reducer =>
    R.pipe(R.set(R.lensPath(['name']), L), R.set(R.lensPath(['message']), L)),
  fetched: (): Reducer =>
    R.pipe(
      R.set(R.lensPath(['name']), { value: '' }),
      R.set(R.lensPath(['message']), { value: '' }),
    ),
}

const Reducers = {
  bucket,
  message,
  name,
  workflow,
}

export default Reducers
