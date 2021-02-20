export default [
  {
    content: `{
      "query": {
        "match": {
          "phrase": {
            "query": "biology"
          }
        }
      }
    }`,
    description: 'Optional description',
    key: 'query-1',
    name: 'My first query',
    url: 's3: //fiskus-sandbox-dev/.quilt/queries/query-1.json',
  },
  {
    content: `{
      "query": {
        "match": {
          "phrase": {
            "query": "genetics"
          }
        }
      }
    }`,
    key: 'get-some-results',
    name: 'Query to get some results',
    url: 's3: //fiskus-sandbox-dev/.quilt/queries/get-some-results.json',
  },
]
