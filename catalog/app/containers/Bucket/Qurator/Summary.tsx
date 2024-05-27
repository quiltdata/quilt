import * as React from 'react'
import * as Lab from '@material-ui/lab'

import Chat from 'components/Chat'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import mkSearch from 'utils/mkSearch'

const Loading = Symbol('Loading')

type EsHit = { _source?: { content?: string } }

type EsOutput = { hits?: { hits?: { _source?: { content?: string } }[] } } | null

interface Hit {
  value: EsHit | null
}

const FILE_PROMPT = (
  content: string,
) => `I will ask you questions about the file's content indexed by ElasticSearch. The ElasticSearch JSON output:

${content}.

Please summarize the content of this file intelligently and concisely. Focus on file's content, don't mention ElasticSearch if unnecessary.`

const NO_CONTENT_PROMPT = (
  json: string,
) => `Please, tell me, that you can't answer questions about the content of the file. It is empty or not yet indexed. But you can tell about meta, indexed by ElasticSearch. This meta is:

${json}`

const NO_DATA_PROMPT = `Please, tell me, that you can't answer questions about the file. It is empty or not yet indexed.
But you can answer questions about Quilt.`

function getPrompt(hit: Hit) {
  if (!hit.value) return NO_DATA_PROMPT
  // eslint-disable-next-line no-underscore-dangle
  if (!hit.value._source?.content) return NO_CONTENT_PROMPT(JSON.stringify(hit.value))
  return FILE_PROMPT(JSON.stringify(hit.value))
}

function useBedrock(foundHit: null | typeof Loading | Error | Hit) {
  const invokeModel = AWS.Bedrock.use()

  const [history, setHistory] = React.useState<
    null | typeof Loading | Error | AWS.Bedrock.History
  >(null)

  React.useEffect(() => {
    if (foundHit === null || foundHit === Loading || foundHit instanceof Error) {
      setHistory(foundHit)
      return
    }

    const message = AWS.Bedrock.createMessage(getPrompt(foundHit), 'summarize')
    const newHistory = AWS.Bedrock.historyCreate(message)
    setHistory(newHistory)
    invokeModel(newHistory).then(setHistory).catch(setHistory)
  }, [foundHit, invokeModel])

  const invoke = React.useCallback(
    async (userInput: string) => {
      if (history === null || history === Loading || history instanceof Error) {
        throw new Error('Invoking model when chat UI is not ready')
      }
      const prompt = AWS.Bedrock.createMessage(userInput)
      const newHistory = AWS.Bedrock.historyAppend(prompt, history)
      setHistory(newHistory)
      try {
        setHistory(await invokeModel(newHistory))
      } catch (e) {
        setHistory(history)
        throw e
      }
    },
    [history, invokeModel],
  )
  return { history, invoke }
}

interface ApiRequest {
  (endpoint: string): Promise<EsOutput>
}

async function loadFileContent(
  req: ApiRequest,
  handle: Model.S3.S3ObjectLocation,
): Promise<Hit> {
  const qs = mkSearch({
    action: 'freeform',
    body: JSON.stringify({
      query: {
        query_string: {
          query: `key:"${handle.key}"`,
        },
      },
    }),
    filter_path: 'hits.hits',
    index: handle.bucket,
    size: 1,
  })
  const res: EsOutput = await req(`/search${qs}`)
  if (!res?.hits?.hits?.length) return { value: null }
  const firstHit: EsHit = res.hits.hits[0]
  // eslint-disable-next-line no-underscore-dangle
  if (firstHit._source?.content) {
    // Take first 80% of "words" (word is the simplest attempt to get token).
    // So, some space is left for user to chat.
    // eslint-disable-next-line no-underscore-dangle
    firstHit._source.content = firstHit._source?.content
      .split(' ')
      .slice(0, 0.8 * AWS.Bedrock.MAX_TOKENS)
      .join(' ')
  }
  return { value: firstHit }
}

const NeverResolvedComponent = React.lazy(
  () =>
    new Promise(() => {
      /* Never resolved */
    }),
)

function useFileContent(handle: Model.S3.S3ObjectLocation) {
  const req: ApiRequest = APIConnector.use()
  const [state, setState] = React.useState<null | typeof Loading | Error | Hit>(null)
  React.useEffect(() => {
    setState(Loading)

    loadFileContent(req, handle).then((content) => {
      if (content === undefined) {
        setState(new Error('Failed to find the content for this file'))
      } else {
        setState(content)
      }
    })
  }, [handle, req])

  return state
}

interface SummaryProps {
  handle: Model.S3.S3ObjectLocation
}

export default function Summary({ handle }: SummaryProps) {
  const fileContent = useFileContent(handle)
  const { history, invoke } = useBedrock(fileContent)

  if (history === null) return null
  // if `history === Loading`, TS thinks history still can be a symbol
  if (typeof history === 'symbol') {
    return <NeverResolvedComponent />
  }

  if (history instanceof Error) {
    return <Lab.Alert severity="error">{history.message}</Lab.Alert>
  }

  return (
    <Chat
      history={history}
      initializing={history.messages[history.messages.length - 1].role === 'summarize'}
      onSubmit={invoke}
    />
  )
}
