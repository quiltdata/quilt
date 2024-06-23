import type { Types as BedrockTypes } from 'aws-sdk/clients/bedrockruntime'
import invariant from 'invariant'
import * as React from 'react'
import * as uuid from 'uuid'

interface ToolDescriptor<I, O> {
  description?: string
  schema: {}
  fn: (params: I) => O
}

type ToolMap = Record<string, ToolDescriptor<any, any>>

const TOOLS: ToolMap = {
  // getContents: {
  //   description: 'Get the contents of a file',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       filename: {
  //         type: 'string',
  //       },
  //     },
  //     required: ['filename'],
  //   },
  //   fn: async ({ filename }: { filename: string }) => {
  //     // eslint-disable-next-line no-console
  //     console.log('TOOL: getContents', filename)
  //     return {
  //       filename,
  //       contents: `
  //         This is a package containing DNA sequences that have been
  //         aligned to the human genome.
  //         `,
  //     }
  //   },
  // },
}

const SYSTEM_PROMPT = `
You are Qurator -- Quilt Data's AI Assistant.
You are a conservative and creative scientist.
When asked a question about Quilt, refer to the documentation at https://docs.quiltdata.com.
For cross-account bucket policies, see https://docs.quiltdata.com/advanced/crossaccount.
Use GitHub flavored Markdown syntax for formatting when appropriate.

Use tools proactively, but don't mention it explicitly, so that it feels transparent.
`

export function useContext() {
  const { tools, messages } = useAggregatedContext()

  const getSystemPrompt = React.useCallback(
    (): BedrockTypes.SystemContentBlocks => messages.map((text) => ({ text })),
    [messages],
  )

  const getToolConfig = React.useCallback(
    (): BedrockTypes.ToolConfiguration => ({
      tools: Object.entries(tools).map(([name, { description, schema }]) => ({
        toolSpec: {
          name,
          description,
          inputSchema: { json: schema },
        },
      })),
      // toolChoice:
    }),
    [tools],
  )

  const callTool = React.useCallback(
    async (name: string, input: any) => tools[name].fn(input),
    [tools],
  )

  return { getSystemPrompt, getToolConfig, callTool }
}

interface ContextShape {
  messages: string[]
  tools: ToolMap
}

interface ContextAggregator {
  push: (context: ContextShape) => () => void
  counter: number
  aggregate: () => ContextShape
}

export const ContextAggregatorCtx = React.createContext<ContextAggregator | null>(null)

export function ContextAggregatorProvider({ children }: React.PropsWithChildren<{}>) {
  const mountedRef = React.useRef<Record<string, ContextShape>>({})
  const [counter, setCounter] = React.useState(0)

  const push = React.useCallback(
    (context: ContextShape) => {
      const id = uuid.v4()
      // eslint-disable-next-line no-console
      console.log('push context', id, context)
      mountedRef.current[id] = context
      setCounter((c) => c + 1)
      return () => {
        delete mountedRef.current[id]
      }
    },
    [mountedRef],
  )

  const aggregate = React.useCallback(
    () => aggregateContext(Object.values(mountedRef.current)),
    [mountedRef],
  )

  const value = { push, counter, aggregate }

  return (
    <ContextAggregatorCtx.Provider value={value}>
      {children}
    </ContextAggregatorCtx.Provider>
  )
}

const ROOT_CONTEXT: ContextShape = {
  tools: TOOLS,
  messages: [SYSTEM_PROMPT],
}

function aggregateContext(contexts: ContextShape[]) {
  // eslint-disable-next-line no-console
  console.log('aggregate', contexts)
  return contexts.reduce(
    (acc, next) => ({
      // XXX: check for conflicts?
      tools: { ...acc.tools, ...next.tools },
      messages: acc.messages.concat(next.messages),
    }),
    ROOT_CONTEXT,
  )
}

function useAggregatedContext(): ContextShape {
  const ctx = React.useContext(ContextAggregatorCtx)
  invariant(ctx, 'ContextAggregator must be used within a ContextAggregatorProvider')

  const { aggregate, counter } = ctx
  const [computed, setComputed] = React.useState(aggregate)

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('COMPUTE aggregated')
    setComputed(aggregate())
  }, [setComputed, aggregate, counter])

  return computed
}

export function usePushContext(context: ContextShape) {
  const ctx = React.useContext(ContextAggregatorCtx)
  invariant(ctx, 'ContextAggregator must be used within a ContextAggregatorProvider')
  const { push } = ctx
  React.useEffect(() => push(context), [push, context])
}

export function Push(context: ContextShape) {
  usePushContext(context)
  return null
}
