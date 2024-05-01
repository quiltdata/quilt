# Package events

When a package is created or revised in a Quilt stack bucket,
the stack emits a `package-revision` event on the default
[EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html)
bus. These events have the following structure:

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

You can create an
[EventBridge rule](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rules.html)
similar to the following to respond to `package-revision` events:

## Example: send email on package creation

```yaml
Description: >
  Demonstrate how to respond to package events.

  Modify `EventBridgeRule` to customize event processing.

  See https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html
  for event pattern syntax.

  See https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html
  for rule targets.
Parameters:
  PackageBucket:
    Type: String
  PackageNamePrefix:
    Type: String
    Description: Leave empty to match every package.
  EmailToSubscribe:
    Type: String
    Description: >
      Confirm subscription over email to receive a copy of package events
      that occur under `PackageNamePrefix` in `PackageBucket`.

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
