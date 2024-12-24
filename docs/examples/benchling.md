<!-- markdownlint-disable-next-line first-line-h1 -->
The Benchling Packager is a lambda you can deploy in your own AWS private cloud
to process [Benchling](https://benchling.com/) events in order to create (and
link back, if possible) a dedicated [Quilt](https://quiltdata.com/) package for
every Benchling notebook.

The CloudFormation template is available as a package on
[open.quiltdata.com](https://open.quiltdata.com/b/quilt-example/packages/examples/benchling-packager).

## Prerequisites

In order to install the benchling packager, you will need to know, and have
administrative access to:

- Your Benchling tenant domain (e.g., `<YOUR_TENANT>` from
  `<YOUR_TENANT>.benchling.com`), for ßconfiguring event subscriptions and
  metadata schemas.
- The AWS Account ID (e.g. 12345689123) and AWS Region (e.g., us-west-2) used by
  your Quilt stack, for configuring the CloudFormation stack and lambdas.

## Installation

Go to the [Benchling Packager
package](https://open.quiltdata.com/b/quilt-example/packages/examples/benchling-packager)
on open.quiltdata.com and follow the instructions in the README.

## References

- [AWS CloudFormation templates](https://aws.amazon.com/cloudformation/resources/templates/)
- [AWS Lambda functions](https://aws.amazon.com/lambda/)
- [Benchling EventBridge events](https://docs.benchling.com/docs/events-getting-started#event-types)
- [Benchling Schemas](https://help.benchling.com/hc/en-us/articles/9684227216781)
