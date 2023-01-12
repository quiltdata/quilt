<!-- markdownlint-disable -->
# Private Endpoint Access

## The Data Perimeter concept

Establishing a **data perimeter** pattern that only allows access to trusted
principals from trusted networks is a best practice to guarantee your
organization's data security. A data perimeter helps protect your data
from unintended access and potential configuration errors via
built-in barriers.

You can restrict Amazon S3 bucket access to a particular VPC and VPN traffic
via a data perimeter pattern, which prevents leaked S3 credentials from 
bypassing your organizations VPN.

> Quilt already has private IPs for all Quilt services (Lambda
functions, API Gateway, Quilt catalog API).

To implement a data perimeter, you will need to take the following steps.

## 1. Configure and deploy a Service Control Policy and Amazon S3 bucket policy

Access should be restricted to trusted networks and principals:

* Allowed VPCs
* Allowed IP ranges
* Specific AWS services used by Quilt:
  * AWS Glue
  * Amazon Athena
  * Amazon CloudWatch
* Principals exempt from network restriction

The easiest way to do this is via a [Service Control
Policy (SCP)](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)

An SCP defines a **guardrail** on any action that the account's
administrator delegates to the IAM users and roles in the account.

> For instructions on enabling SCPs, see the [AWS documentation on
"Enabling and disabling policy
types"](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_enable-disable.html)

### Example Service Control Policy

The example policy below denies access (`"Effect": "Deny"`) to all
Amazon S3 buckets prefixed with the string `quilt`
unless **all** of the following conditions are met:

1. A `Source VPN` matches either `vpc-LOCAL` or `vpc-VPN`.
2. A tag attached to the principal making the request with the key
`aws:PrincipalTag/NetworkRestrictedExempt` has the value `true`
3. The request must come from any IP **except** the range `192.0.2.0
- 192.0.2.255` and `203.0.113.0 - 203.0.113.255`
4. The call to the S3 bucket is beng made by an AWS [service
principal](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html#principal-services)
(the idenitifer for a service, `"aws:PrincipalIsAWSService"`), such
as CloudWatch, or by an AWS service to another service
(`"aws:ViaAWSService"`).

<!--pytest.mark.skip-->
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

SCPs should be used in parallel with identity-based or resource-based
policies to IAM users or roles, or [explicit S3 bucket
policies](../CrossAccount.md#bucket-policies)

## 2. Configure S3 Gateway Endpoint in Quilt application VPC

> Whoever manages the VPC route table should manage the Gateway endpoint

**TO DO:** Customer instructions if custom VPC
**TO DO:** Quilt instructions if Quilt-default VPC

**TO DO:** Private Amazon S3 endpoint (INTERFACE ENDPOINT/GATEWAY ENDPOINT)
  - AWS PrivateLink for Amazon S3
  - Interface Endpoint overview

> Keeping traffic on provuate networks will incur Transit Gateway,
inter-VPC, and Interface Endpoint charges
> DNS of the VPN clients must assign AWS global and regional S3
service names to the Interface Endpoint IP addresses

## **TO DO:** 3. Configure the application VPC to resolve S3 endpoints to the S3 Interface Endpoints in the central VPC

## **TO DO:** Deployment Playbook Summary (developer or cloud administrator)

1. What do I need to change to make this take effect?
  1.1. Clean install
  1.2. Upgrade from an existing stack
2. What happens when I turn it on?


## Further reading

* [Choosing your VPC Endpoint Strategy for Amazon S3](https://aws.amazon.com/blogs/architecture/choosing-your-vpc-endpoint-strategy-for-amazon-s3/)
* [Secure hybrid access to Amazon S3 using AWS PrivateLink](https://aws.amazon.com/blogs/networking-and-content-delivery/secure-hybrid-access-to-amazon-s3-using-aws-privatelink/)
* [Establishing a Data Perimeter](https://aws.amazon.com/blogs/security/establishing-a-data-perimeter-on-aws/)
* [Building a Data Perimeter Whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/building-a-data-perimeter-on-aws.html)

## Orphaned content

AWS has [interface VPC
endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html)
and they give you a private IP.
