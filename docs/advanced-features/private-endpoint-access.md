<!-- markdownlint-disable -->
# Private endpoints 

> This page describes a feature that is not enabled by default.
You can ask your Quilt account manager to enable it.

## Data perimeters 

A **data perimeter** ensures that only **trusted principals** on **expected networks**
can access **trusted resources**.

For example, you may wish to ensure that only private IPs can access data in
Amazon S3, Quilt's primary data store. Such a data perimeter strengthens
your security by ensuring that S3 credentials alone are not sufficient to access
data in Amazon S3.

In order for Quilt to function properly with expected private networks, your Quilt
account manager must configure your CloudFormation stack to run its services
(e.g. Lambda, API Gateway) on private IPs.

Additionally you will need to create and configure the following AWS resources,
or equivalents depending on your network architecture:

1. Create an [interface VPC endpoint](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html)
for Amazon API Gateway.

    This interface endpoint is used by Quilt's backend services to keep network traffic private to your VPC.
    Enter the VPC endpoint ID in your CloudFormation template as the `ApiGatewayVPCEndpointId`
    template parameter.

    > Note that, even if you do not use private endpoints for Quilt services,
    > traffic between your VPC and AWS services
    > [does not leave the AWS network backbone](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/centralized-access-to-vpc-private-endpoints.html).

1. Create an Amazon S3 Gateway endpoint.

    [S3 gateway endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html)
    facilitate access to S3 from the VPC that you run Quilt in.

    > AWS permits one [S3 gateway endpoint](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html) per VPC per region
    > If you wish to connect buckets from multiple stacks to Quilt, a transit
    VPC or similar design is required.

1. Provide a NAT gateway (or similar).

    Quilt's private endpoints require access to public Internet services like Amazon ECR and Amazon SNS.

    > See [Amazon's guide on NAT gateways](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html#nat-gateway-creating).

1. Test and apply policies to enforce your data perimeter.

    We recommend that you test an individual bucket policy on a clean bucket to prevent
    inadvertent loss of access to your data.
    Once Quilt and other services are able to access this experimental bucket as
    expected, you can graduate to a more comprehensive
    [Service Control Policy (SCP)](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
    to implement your data perimeter at the organization level.
    SCPs define **guardrails** on any action that the account's
    administrator delegates to the IAM users and roles in the account.

    > See
    ["Enabling and disabling policy types"](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_enable-disable.html)
    for more on SCPs.

## Example Service Control Policy

The following SCP establishes a data perimeter around all in-organization
Amazon S3 buckets prefixed with the string "quilt"
such that only principals with _one or more_ of the following characteristics
can access data in Amazon S3.

1. The source VPC is either `vpc-LOCAL` or `vpc-VPN`.
2. The principal on the request has the `NetworkRestrictedExempt` tag.
    > Use this tag as a failsafe entry point when testing and debugging your SCP
3. The request comes from a specific IP range (e.g. `192.0.2.0 - 192.0.2.255`).
4. The principal is an [AWS service
principal](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html#principal-services).

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PreventUnexpectedNetworksButAllowAWSServices",
            "Effect": "Deny",
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::quilt*",
                "arn:aws:s3:::quilt*/*"
            ],
            "Condition": {
                "StringNotEqualsIfExists": {
                    "aws:SourceVpc": [
                        "vpc-LOCAL",
                        "vpc-VPN"
                    ]
                },
                "Null": {
                    "aws:PrincipalTag/NetworkRestrictedExempt": "true"
                },
                "NotIpAddressIfExists": {
                    "aws:SourceIp": [
                        "192.0.2.0/24",
                        "203.0.113.0/24"
                    ]
                },
                "Bool": {
                    "aws:PrincipalIsAWSService": "false",
                    "aws:ViaAWSService": "false"
                }
            }
        }
    ]
}
```

## Verifying your setup

If you have [Quilt canaries](./good-practice.md) enabled, check the catalog admin
panel to ensure that they are functioning.

## Considerations

1. There can only be one S3 gateway endpoint per VPC.
2. Your S3 buckets must be in the same region as the gateway endpoint.
2. Routing traffic on private networks may incur Transit Gateway,
inter-VPC, and Interface Endpoint charges.
3. The DNS of any VPN clients must assign AWS global and regional S3
service names to the Interface Endpoint IP addresses.

## References

* [Choosing your VPC Endpoint Strategy for Amazon S3](https://aws.amazon.com/blogs/architecture/choosing-your-vpc-endpoint-strategy-for-amazon-s3/)
* [Secure hybrid access to Amazon S3 using AWS PrivateLink](https://aws.amazon.com/blogs/networking-and-content-delivery/secure-hybrid-access-to-amazon-s3-using-aws-privatelink/)
* [Establishing a Data Perimeter](https://aws.amazon.com/blogs/security/establishing-a-data-perimeter-on-aws/)
* [Building a Data Perimeter Whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/building-a-data-perimeter-on-aws.html)
