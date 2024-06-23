import type { Types as BedrockTypes } from 'aws-sdk/clients/bedrockruntime'
import invariant from 'invariant'

import * as React from 'react'
import * as M from '@material-ui/core'

import Chat from 'components/Chat'
import * as style from 'constants/style'
import * as AWS from 'utils/AWS'

interface OmniCtx {
  isOpen: boolean
  open: () => void
  close: () => void
}

const Ctx = React.createContext<OmniCtx | null>(null)

export function Provider({ children }: React.PropsWithChildren<{}>) {
  const [isOpen, setOpen] = React.useState(false)
  const open = React.useCallback(() => setOpen(true), [])
  const close = React.useCallback(() => setOpen(false), [])
  const value = React.useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const SYSTEM_PROMPT = `
You are Qurator -- Quilt Data's AI Assistant.
You are a conservative and creative scientist.
When asked a question about Quilt, refer to the documentation at https://docs.quiltdata.com.
For cross-account bucket policies, see https://docs.quiltdata.com/advanced/crossaccount.
Use GitHub flavored Markdown syntax for formatting when appropriate.

Use tools proactively, but don't mention it explicitly, so that it feels transparent.
`

const MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0'
// const MODEL_ID = 'anthropic.claude-3-5-sonnet-20240620-v1:0'

const stringifyContentBlock = (content: BedrockTypes.ContentBlock): string => {
  if (content.text) return content.text
  // if (content.toolUse) return `tool use: ${JSON.stringify(content.toolUse)}`
  // if (content.toolResult) return `tool result: ${JSON.stringify(content.toolResult)}`
  return JSON.stringify(content)
}

interface ToolDescriptor<I, O> {
  description?: string
  schema: {}
  fn: (params: I) => O
}

const TOOLS: Record<string, ToolDescriptor<any, any>> = {
  getContents: {
    description: 'Get the contents of a file',
    schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
        },
      },
      required: ['filename'],
    },
    fn: async ({ filename }: { filename: string }) => {
      // eslint-disable-next-line no-console
      console.log('TOOL: getContents', filename)
      return {
        filename,
        contents: `
          This is a package containing DNA sequences that have been
          aligned to the human genome.
          `,
      }
    },
  },
}

function useOmni() {
  const bedrock = AWS.Bedrock.useClient()

  const [history, setHistory] = React.useState([] as BedrockTypes.Messages)
  const [loading, setLoading] = React.useState(false)

  const getSystemPrompt = React.useCallback(
    (): BedrockTypes.SystemContentBlocks => [
      { text: SYSTEM_PROMPT },
      // TODO: extra context goes here
      {
        text: 'You are currently viewing the Quilt Catalog page for a file named README.md',
      },
    ],
    [],
  )

  const getToolConfig = React.useCallback(
    (): BedrockTypes.ToolConfiguration => ({
      tools: Object.entries(TOOLS).map(([name, { description, schema }]) => ({
        toolSpec: {
          name,
          description,
          inputSchema: { json: schema },
        },
      })),
      // toolChoice:
    }),
    [],
  )

  const converse = React.useCallback(
    async (messages: BedrockTypes.Messages) => {
      // eslint-disable-next-line no-console
      console.log('converse', messages)
      const resp = await bedrock
        .converse({
          modelId: MODEL_ID,
          system: getSystemPrompt(),
          messages,
          toolConfig: getToolConfig(),
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
    [bedrock, getSystemPrompt, getToolConfig],
  )

  const callTool = React.useCallback(
    async (name: string, input: any) => TOOLS[name].fn(input),
    [],
  )

  const converseRec = React.useCallback(
    async (messages: BedrockTypes.Messages) => {
      const resp = await converse(messages)
      if (resp.stopReason !== 'tool_use') return resp

      const assistantMsg = resp.output.message
      invariant(assistantMsg, 'expected assistant message to be non-empty')

      setHistory((h) => h.concat(assistantMsg))

      const tus = assistantMsg.content.reduce(
        (acc, c) => (c.toolUse ? acc.concat(c.toolUse) : acc),
        [] as BedrockTypes.ToolUseBlock[],
      )

      const toolResultsPs = tus.map(({ toolUseId, name, input }) =>
        callTool(name, input)
          .then((json) => ({
            toolUseId,
            content: [{ json }],
          }))
          .catch((err) => ({
            toolUseId,
            content: [{ text: `Error: ${err}` }],
            status: 'error',
          })),
      )

      const toolResults = await Promise.all(toolResultsPs)

      const userMsg: BedrockTypes.Message = {
        role: 'user',
        content: toolResults.map((toolResult) => ({ toolResult })),
      }

      setHistory((h) => h.concat(userMsg))

      return converse(messages.concat(assistantMsg, userMsg))
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

function Omni() {
  const omni = useOmni()

  return (
    <Chat
      history={{ messages: omni.messages }}
      initializing={false}
      onSubmit={omni.sendMessage}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
    width: '50vw',
  },
}))

export function Sidebar() {
  const classes = useStyles()

  const omni = React.useContext(Ctx)
  if (!omni) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer anchor="right" open={omni.isOpen} onClose={omni.close}>
        <div className={classes.root}>
          <M.Typography variant="h4">Qurator</M.Typography>
          <Omni />
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
  const omni = React.useContext(Ctx)
  if (!omni) return null
  return (
    <M.Zoom in={!omni.isOpen}>
      <M.Fab onClick={omni.open} className={classes.trigger} color="primary">
        <M.Icon>assistant</M.Icon>
      </M.Fab>
    </M.Zoom>
  )
}
