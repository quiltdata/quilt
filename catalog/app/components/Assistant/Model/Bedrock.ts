import BedrockRuntime from 'aws-sdk/clients/bedrockruntime'
import * as Eff from 'effect'

import * as Content from './Content'
import * as LLM from './LLM'

const MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0'
// const MODEL_ID = 'anthropic.claude-3-5-sonnet-20240620-v1:0'

const mapContent = (contentBlocks: BedrockRuntime.ContentBlocks | undefined) =>
  Eff.pipe(
    contentBlocks,
    Eff.Option.fromNullable,
    Eff.Option.map(
      Eff.Array.flatMapNullable((c) => {
        if (c.document) {
          return Content.ResponseMessageContentBlock.Document({
            format: c.document.format as $TSFixMe,
            source: c.document.source.bytes as $TSFixMe,
            name: c.document.name,
          })
        }
        if (c.image) {
          return Content.ResponseMessageContentBlock.Image({
            format: c.image.format as $TSFixMe,
            source: c.image.source.bytes as $TSFixMe,
          })
        }
        if (c.text) {
          return Content.ResponseMessageContentBlock.Text({ text: c.text })
        }
        if (c.toolUse) {
          return Content.ResponseMessageContentBlock.ToolUse(c.toolUse as $TSFixMe)
        }
        // if (c.guardContent) {
        //   // TODO
        //   return acc
        // }
        // if (c.toolResult) {
        //   // XXX: is it really supposed to occur here in LLM response?
        //   return acc
        // }
        return null
      }),
    ),
  )

// TODO: use Schema
const contentToBedrock = Content.PromptMessageContentBlock.$match({
  GuardContent: ({ text }) => ({ guardContent: { text: { text } } }),
  ToolResult: ({ toolUseId, status, content }) => ({
    toolResult: {
      toolUseId,
      status,
      content: content.map(
        Content.ToolResultContentBlock.$match({
          Json: ({ _tag, ...rest }) => rest,
          Text: ({ _tag, ...rest }) => rest,
          // XXX: be careful with base64/non-base64 encoding
          Image: ({ format, source }) => ({
            image: { format, source: { bytes: source } },
          }),
          Document: ({ format, source, name }) => ({
            document: { format, source: { bytes: source }, name },
          }),
        }),
      ),
    },
  }),
  ToolUse: ({ _tag, ...toolUse }) => ({ toolUse }),
  Text: ({ _tag, ...rest }) => rest,
  Image: ({ format, source }) => ({ image: { format, source: { bytes: source } } }),
  Document: ({ format, source, name }) => ({
    document: { format, source: { bytes: source }, name },
  }),
})

const messagesToBedrock = (
  messages: Eff.Array.NonEmptyArray<LLM.PromptMessage>,
): BedrockRuntime.Message[] =>
  // create an array of alternating assistant and user messages
  Eff.pipe(
    messages,
    Eff.Array.groupWith((m1, m2) => m1.role === m2.role),
    Eff.Array.map((group) => ({
      role: group[0].role,
      content: group.map((m) => contentToBedrock(m.content)),
    })),
  )

const toolConfigToBedrock = (
  toolConfig: LLM.ToolConfig,
): BedrockRuntime.ToolConfiguration => ({
  tools: Object.entries(toolConfig.tools).map(([name, { description, schema }]) => ({
    toolSpec: {
      name,
      description,
      inputSchema: { json: schema },
    },
  })),
  toolChoice:
    toolConfig.choice &&
    LLM.ToolChoice.$match(toolConfig.choice, {
      Auto: () => ({ auto: {} }),
      Any: () => ({ any: {} }),
      Specific: ({ name }) => ({ tool: { name } }),
    }),
})

// a layer providing the service over aws.bedrock
export function LLMBedrock(bedrock: BedrockRuntime) {
  const converse = (prompt: LLM.Prompt, opts?: LLM.Options) =>
    Eff.Effect.tryPromise(() =>
      bedrock
        .converse({
          modelId: MODEL_ID,
          system: [{ text: prompt.system }],
          messages: messagesToBedrock(prompt.messages),
          toolConfig: prompt.toolConfig && toolConfigToBedrock(prompt.toolConfig),
          ...opts,
        })
        .promise()
        .then((backendResponse) => ({
          backendResponse,
          content: mapContent(backendResponse.output.message?.content),
        })),
    )

  return Eff.Layer.succeed(LLM.LLM, { converse })
}
