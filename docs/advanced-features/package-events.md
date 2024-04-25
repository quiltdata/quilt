# Package events

Every time a package revision is created in one of the Quilt stack buckets, the Quilt stack
emits event to the default
[EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html)
bus. The event has the following structure:

```json
{
    "version": "0",
    "id": "6425eb6a-9627-e6a1-2ae8-9d2d8883dc74",
    "detail-type": "package-revision",
    "source": "com.quiltdata",
    "account": "012345678901",
    "time": "2024-04-25T14:46:51Z",
    "region": "us-east-1",
    "resources": [],
    "detail": {
        "version": "0.1",
        "type": "created",
        "bucket": "example",
        "handle": "some/package",
        "topHash": "a0fddace2eb2fd91faa697d237a5dbdcfa77f0fd38ca8b4c850dbd93d142ee69"
    }
}
```

To handle such events you need to create an
[EventBridge rule](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rules.html).

## Example: send email on package creation

```yaml
Description: >
  Example Cloudformation template demonstrating usage
  of Quilt package events.

  Email specified by `EmailToSubscribe` parameter will get notifications
  about new revisions of package with name prefix specified by
  `PackageNamePrefix` parameter in `PackageBucket` bucket.
  After stack creation specified email will receive mail message to confirm
  subscription.

  To customize what events are processed and how they are processed
  you need to modify `EventBridgeRule`.

  See https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html
  for syntax of event patterns.

  See https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html
  for a list of supported targets.

Parameters:
  PackageBucket:
    Type: String
  PackageNamePrefix:
    Type: String
    Description: Leave empty to match every package.
  EmailToSubscribe:
    Type: String
    Description: Email that will get package notifications.

Resources:
  EventBridgeRule:
    Type: AWS::Events::Rule
    Properties:
      EventPattern:
        source:
          - "com.quiltdata"
        detail-type:
          - "package-revision"
        detail:
          type:
            - "created"
          handle:
            - prefix: !Ref PackageNamePrefix
          bucket:
            - !Ref PackageBucket
      Targets:
        - Arn: !Ref SNSTopic
          Id: "OpsTopic"

  SNSTopic:
    Type: AWS::SNS::Topic

  SNSTopicPolicy:
    Type: AWS::SNS::TopicPolicy
    Properties:
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: events.amazonaws.com
            Action: 'sns:Publish'
            Resource: '*'
      Topics:
        - !Ref SNSTopic

  SNSTopicSubscription:
    Type: AWS::SNS::Subscription
    Properties:
      Endpoint: !Ref EmailToSubscribe
      Protocol: email
      TopicArn: !Ref SNSTopic
```
