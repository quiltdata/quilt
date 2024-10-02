# Qurator Omni Beta

`Qurator Omni` is an always-available AI assistant embedded directly into the
Quilt web catalog. It allows users to interact with Quilt packages and search
functionality through natural language. Qurator Omni leverages advanced models
like Claude, integrated via AWS Bedrock, enabling users to query, retrieve, and
summarize data instead of having click through the GUI.

## What is Qurator Omni?

Qurator Omni is designed to streamline interaction with Quilt data by offering a
conversational interface. Instead of navigating through various tabs and menus,
or learning complicated search syntax, users can opt into the Qurator feature to
ask complex questions in plain language and receive structured, actionable
responses.

For example, users can ask for summaries of research on topics like "melanoma"
or request key insights from a specific dataset.

### Key Features

- **Natural Language Queries**: Ask complex questions like _“What’s known about
  BRCA1 research?”_ or _“Show the latest asthma treatment data”_ to interact
  with information stored in private or public S3 buckets, such as [PubMed
  PMC](https://open.quiltdata.com/b/pmc-oa-opendata) or other [Open Data on
  AWS](https://registry.opendata.aws/).
- **Data Summarization**: Qurator Omni can summarize the key points of research
  papers, presentations, or datasets, offering concise, digestible insights
  without needing to review the full content.
- **Opt-in Integration**: Your data is always your own. Administrators must
  explicitly enable the Qurator Omni feature, and configure the appropriate
  Claude model in AWS Bedrock, before users can access the AI assistant.
  Everything runs in your own private cloud environment; nothing is shared with
  Quilt or accessible to third parties.

## Getting Started

To enable Qurator Omni:

1. **Opt-In to Qurator**:  
   - Install Release 1.55 or later of the Quilt Platform CloudFormation template.
   - Set the `qurator` parameter to `true` in the CloudFormation template to
     enable the Qurator chatbot.

2. **Configure Claude Model**:  
   - Login to the AWS Bedrock console.
   - Ensure that the Claude 3.5 Sonnet model is available in the same region as
     your Quilt deployment. Check [Model support by AWS
     Region](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html)
     for details.
   - Enable the model by configuring it within your Bedrock environment.
   - Carefully monitor the model’s cost implications. The Claude model is
     charged based on usage, so ensure that you have the necessary budget
     allocated. Initial estimates are roughly a penny per page for complex documents,

3. **Start Using Qurator**:  
   - Once activated, the Qurator chatbot will appear in the Quilt web catalog
     interface.
   - Click the Qurator icon on the
     bottom right of the screen to open the chat interface. ![qurator icon](../imgs/qurator-icon.png)
   - You can begin by typing questions into the chat interface. For example,
     queries like _“What are the key findings on small molecule delivery?”_ will
     prompt Qurator to retrieve relevant packages and present a summarized
     overview.

### Example Use Cases

- **Search**: _“What are the latest papers on melanoma?”_  
  Qurator will search through the Quilt packages and retrieve the most relevant
  data.
  
- **Summarize**: _“Summarize the key points of this BRCA1 research.”_  
  After selecting a specific document, Qurator will generate a clear, useful
  summary of the paper.

- **Deep Dive**: _“Who are the top authors in breast cancer research?”_  
  Qurator Omni will list key authors and their contributions based on Quilt’s
  indexed datasets.

### Key Benefits

- **Enhanced Productivity**: Eliminate the need for manual search navigation,
  enabling faster access to critical information.
- **Improved Insights**: Gain deeper insights from large datasets with automatic
  summaries.
- **Streamlined Collaboration**: Easily share summarized findings and insights
  with colleagues directly from the web catalog.
