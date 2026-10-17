import { act, cleanup, render } from '@testing-library/react'
import * as Eff from 'effect'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Context from './Context'

vi.mock('constants/config', () => ({ default: {} }))

function Grab({
  onLayer,
}: {
  onLayer: (l: ReturnType<typeof Context.useLayer>) => void
}) {
  onLayer(Context.useLayer())
  return null
}

function Probe({
  pending,
  onLayer,
}: {
  pending: boolean
  onLayer: (l: ReturnType<typeof Context.useLayer>) => void
}) {
  return (
    <Context.ContextAggregatorProvider>
      <Context.Push markers={{ [Context.PROMPT_SETTLED]: !pending }} messages={['ctx']} />
      <Grab onLayer={onLayer} />
    </Context.ContextAggregatorProvider>
  )
}

const tick = () => act(() => new Promise((r) => setTimeout(r, 20)))

describe('components/Assistant/Model/Context', () => {
  afterEach(cleanup)

  it('makes a turn wait until the prompt contract settles, then reads the context', async () => {
    let layer: ReturnType<typeof Context.useLayer> | undefined
    const onLayer = (l: ReturnType<typeof Context.useLayer>) => {
      layer = l
    }
    const { rerender } = render(<Probe pending onLayer={onLayer} />)
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

    rerender(<Probe pending={false} onLayer={onLayer} />)
    await tick()
    expect(read?.messages).toEqual(['ctx'])
    expect(read?.markers[Context.PROMPT_SETTLED]).toBe(true)
  })
})
