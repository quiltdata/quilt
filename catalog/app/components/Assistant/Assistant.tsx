import type { Types as BedrockTypes } from 'aws-sdk/clients/bedrockruntime'
import dedent from 'dedent'
import invariant from 'invariant'

import * as React from 'react'
import * as M from '@material-ui/core'

import Chat from 'components/Chat'
import * as style from 'constants/style'
import * as AWS from 'utils/AWS'

import * as Context from './Context'
import * as Tools from './tools'

const MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0'
// const MODEL_ID = 'anthropic.claude-3-5-sonnet-20240620-v1:0'

const stringifyContentBlock = (content: BedrockTypes.ContentBlock): string => {
  if (content.text) return content.text
  // if (content.toolUse) return `tool use: ${JSON.stringify(content.toolUse)}`
  // if (content.toolResult) return `tool result: ${JSON.stringify(content.toolResult)}`
  return JSON.stringify(content)
}

function useGlobalTools(): Context.ToolMap {
  const searchTools = Tools.useSearchTools()
  return React.useMemo(() => ({ ...searchTools }), [searchTools])
}

// prompt structure
// - task context
// - tone context
// - Background data, documents, and images
// - detailed task description and rules
// - examples
// - input data
//   - conversation history
//   - user input
// - immediate task
// - precognition
// - output formatting
// - prefill

const TASK_CONTEXT = dedent`
  You are Qurator, an AI assistant created by Quilt Data.
  Your goal is to assist users of Quilt Data products.
  Specifically, you will be replying to the users of the Quilt Catalog web app.

  Act and speak like a conservative and creative scientist.
`

// XXX: add context about quilt products?
// XXX: add context about catalog structure and features?

const TASK_DESCRIPTION = dedent`
  When asked a question about Quilt or Quilt Data, refer to the documentation at https://docs.quiltdata.com.
  For cross-account bucket policies, see https://docs.quiltdata.com/advanced/crossaccount.
`

const IMMEDIATE_TASK = dedent`
  The actual conversation will follow, advance it in the most helpful way possible.
`

const PRECOGNITION = dedent`
  Think step by step and carefully analyze the provided context to prevent giving incomplete or inaccurate information.
  Never make things up, always double-check your responses and use the context to your advantage.
`

const OUTPUT_INSTRUCTIONS = dedent`
  Use GitHub flavored Markdown syntax for formatting when appropriate.
  Use tools proactively, but don't mention that unnecessarily, so that it feels transparent.
`

const makeSystemPrompt = (extraContext: string) => dedent`
  ${TASK_CONTEXT}
  ${TASK_DESCRIPTION}
  <context>
  ${extraContext}
  </context>
  ${PRECOGNITION}
  ${OUTPUT_INSTRUCTIONS}
  ${IMMEDIATE_TASK}
`

const getToolConfig = (tools: Context.ToolMap) =>
  Object.entries(tools).map(([name, { description, schema }]) => ({
    toolSpec: {
      name,
      description,
      inputSchema: { json: schema },
    },
  }))

const MAX_TOOL_USE_ROUNDS = 3

function useAssistant() {
  const bedrock = AWS.Bedrock.useClient()

  const [history, setHistory] = React.useState([] as BedrockTypes.Messages)
  const [loading, setLoading] = React.useState(false)

  Context.usePushContext({
    tools: useGlobalTools(),
  })

  const ctx = Context.useAggregatedContext()

  const callTool = React.useCallback(
    async (name: string, input: any) => ctx.tools[name].fn(input),
    [ctx.tools],
  )

  const converse = React.useCallback(
    async (messages: BedrockTypes.Messages) => {
      const extraContext = ctx.messages.join('\n')
      const system = makeSystemPrompt(extraContext)
      const tools = getToolConfig(ctx.tools)

      // eslint-disable-next-line no-console
      console.log('converse', { system, tools: ctx.tools, messages })
      // eslint-disable-next-line no-console
      console.log('converse stats', {
        extraContext: ctx.messages.map((m) => m.length),
        systemTotal: system.length,
        tools: tools.map((t) => JSON.stringify(t).length),
        messages: messages.map((m) => JSON.stringify(m).length),
      })

      const resp = await bedrock
        .converse({
          modelId: MODEL_ID,
          system: [{ text: system }],
          messages,
          toolConfig: {
            tools,
            // toolChoice,
          },
          // inferenceConfig?: InferenceConfiguration;
          // guardrailConfig?: GuardrailConfiguration;
          // additionalModelRequestFields?: Document;
          // additionalModelResponseFieldPaths?: ConverseRequestAdditionalModelResponseFieldPathsList;
        })
        .promise()
      // eslint-disable-next-line no-console
      console.log('converse resp', resp)
      return resp
    },
    [bedrock, ctx.messages, ctx.tools],
  )

  const converseRec = React.useCallback(
    async (messages: BedrockTypes.Messages) => {
      let roundsLeft = MAX_TOOL_USE_ROUNDS
      while (true) {
        const resp = await converse(messages)
        if (resp.stopReason !== 'tool_use') return resp
        if (roundsLeft <= 0) {
          return {
            ...resp,
            output: {
              ...resp.output,
              message: {
                role: 'assistant',
                content: [
                  ...(resp.output.message?.content || []),
                  { text: `Error: tool use rounds exhausted (${MAX_TOOL_USE_ROUNDS})` },
                ],
              },
            },
          }
        }

        const assistantMsg = resp.output.message
        invariant(assistantMsg, 'expected assistant message to be non-empty')

        setHistory((h) => h.concat(assistantMsg))

        const tus = assistantMsg.content.reduce(
          (acc, c) => (c.toolUse ? acc.concat(c.toolUse) : acc),
          [] as BedrockTypes.ToolUseBlock[],
        )

        invariant(tus.length, 'expected one or more tool use blocks')

        const toolResultsPs = tus.map(({ toolUseId, name, input }) =>
          callTool(name, input)
            .then((content) => ({ content }))
            .catch((err) => ({
              content: [{ text: `Error: ${err}` }],
              status: 'error',
            }))
            .then((data) => ({ ...data, toolUseId })),
        )

        const toolResults = await Promise.all(toolResultsPs)

        const userMsg: BedrockTypes.Message = {
          role: 'user',
          content: toolResults.map((toolResult) => ({ toolResult })),
        }

        setHistory((h) => h.concat(userMsg))

        // start new round
        messages = messages.concat(assistantMsg, userMsg)
        roundsLeft--
      }
    },
    [converse, callTool],
  )

  const sendMessage = React.useCallback(
    async (text: string) => {
      if (loading) return
      if (!text) return

      const message: BedrockTypes.Message = { role: 'user' as const, content: [{ text }] }

      const newHistory = history.concat(message)
      setHistory(newHistory)

      try {
        setLoading(true)
        const resp = await converseRec(newHistory)

        // output: ConverseOutput;
        // stopReason: StopReason;
        // usage: TokenUsage;
        // metrics: ConverseMetrics;
        // additionalModelResponseFields?: Document;
        // trace?: ConverseTrace;

        const respMsg = resp.output.message || {
          role: 'assistant' as const,
          content: [{ text: `Empty response. Stop reason: ${resp.stopReason}` }],
        }
        setHistory((h) => h.concat(respMsg))
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        setHistory((h) =>
          h.concat({
            role: 'assistant' as const,
            content: [{ text: `Error: ${e}` }],
          }),
        )
      } finally {
        setLoading(false)
      }
    },
    [history, loading, converseRec],
  )

  const normalizedMessages = React.useMemo(
    () =>
      history.reduce(
        (messages, m) =>
          messages.concat(
            m.content.map((c) => ({
              role: m.role as 'user' | 'assistant',
              content: stringifyContentBlock(c),
            })),
          ),
        [] as AWS.Bedrock.Message[],
      ),
    [history],
  )

  return { history, sendMessage, loading, messages: normalizedMessages }
}

type AssistantAPI = ReturnType<typeof useAssistant>

interface AssistantCtx {
  isOpen: boolean
  open: (msg?: string) => void
  close: () => void
  assistant: AssistantAPI
}

const Ctx = React.createContext<AssistantCtx | null>(null)

function AssistantProvider({ children }: React.PropsWithChildren<{}>) {
  const assistant = useAssistant()
  const [isOpen, setOpen] = React.useState(false)
  const { sendMessage } = assistant
  const open = React.useCallback(
    (msg?: string) => {
      setOpen(true)
      if (msg) sendMessage(msg)
    },
    [sendMessage],
  )
  const close = React.useCallback(() => setOpen(false), [])
  const value = { isOpen, open, close, assistant }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function Provider({ children }: React.PropsWithChildren<{}>) {
  return (
    <Context.ContextAggregatorProvider>
      <AssistantProvider>{children}</AssistantProvider>
    </Context.ContextAggregatorProvider>
  )
}

function Assistant({ messages, sendMessage, loading }: AssistantAPI) {
  return <Chat history={{ messages }} initializing={loading} onSubmit={sendMessage} />
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
    width: '50vw',
  },
}))

export function Sidebar() {
  const classes = useStyles()

  const ctx = React.useContext(Ctx)
  if (!ctx) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer anchor="right" open={ctx.isOpen} onClose={ctx.close}>
        <div className={classes.root}>
          <M.Typography variant="h4">Qurator</M.Typography>
          <Assistant {...ctx.assistant} />
        </div>
      </M.Drawer>
    </M.MuiThemeProvider>
  )
}

const useTriggerStyles = M.makeStyles({
  trigger: {
    bottom: '50px',
    position: 'fixed',
    right: '100px',
    zIndex: 1,
  },
})

export function Trigger() {
  const classes = useTriggerStyles()
  const ctx = React.useContext(Ctx)
  if (!ctx) return null
  return (
    <M.Zoom in={!ctx.isOpen}>
      <M.Fab onClick={() => ctx.open()} className={classes.trigger} color="primary">
        <M.Icon>assistant</M.Icon>
      </M.Fab>
    </M.Zoom>
  )
}

export function WithUI({ children }: React.PropsWithChildren<{}>) {
  return (
    <>
      {children}
      <Trigger />
      <Sidebar />
    </>
  )
}

export function useAssistantCtx() {
  return React.useContext(Ctx)
}
