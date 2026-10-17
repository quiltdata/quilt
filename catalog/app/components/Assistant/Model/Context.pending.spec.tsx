import { act, cleanup, render } from '@testing-library/react'
import * as Eff from 'effect'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Context from './Context'

vi.mock('constants/config', () => ({ default: {} }))

const MARKER = 'ready'

let layer: ReturnType<typeof Context.useLayer> | undefined

function Grab() {
  layer = Context.useLayer({ marker: MARKER, timeoutMs: 60_000 })
  return null
}

function Probe({ ready }: { ready: boolean }) {
  return (
    <Context.ContextAggregatorProvider>
      <Context.Push markers={{ [MARKER]: ready }} messages={['ctx']} />
      <Grab />
    </Context.ContextAggregatorProvider>
  )
}

const tick = () => act(() => new Promise((r) => setTimeout(r, 20)))

describe('components/Assistant/Model/Context', () => {
  afterEach(cleanup)

  it('makes a read wait until its marker is set, then reads the context', async () => {
    const { rerender } = render(<Probe ready={false} />)
    let read: Context.ContextShape | undefined
    Eff.Effect.runPromise(
      Eff.Effect.flatMap(Context.ConversationContext, (s) => s.context).pipe(
        Eff.Effect.provide(layer!),
      ),
    ).then((c) => {
      read = c
    })
    await tick()
    expect(read).toBeUndefined()

    rerender(<Probe ready />)
    await tick()
    expect(read?.messages).toEqual(['ctx'])
    expect(read?.markers[MARKER]).toBe(true)
  })
})
