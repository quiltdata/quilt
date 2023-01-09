<!-- markdownlint-disable -->
# Restricting Access to S3 Buckets

## Introducing the Data Perimeter concept

Establishing a **data perimeter** pattern that only allows access to trusted
principals from trusted networks is a best practice to guarantee your
organization's data security. This strategy helps protect your data
from unintended access and potential configuration errors via
built-in barriers.

You can restrict Amazon S3 bucket access to a particular VPC and VPN traffic
via a data perimeter pattern, which prevents leaked S3 credentials from 
bypassing your organizations VPN.

Quilt 

AWS IAM directly supports this pattern in both Amazon S3 bucket
resource policies and Service Control Policies (SCP).

## Playbook

1. What do I need to change
2. What happens when I turn it on


## Further reading

* [Choosing your VPC Endpoint Strategy for Amazon S3](https://aws.amazon.com/blogs/architecture/choosing-your-vpc-endpoint-strategy-for-amazon-s3/)
* [Secure hybrid access to Amazon S3 using AWS PrivateLink](https://aws.amazon.com/blogs/networking-and-content-delivery/secure-hybrid-access-to-amazon-s3-using-aws-privatelink/)
* [Establishing a Data Perimeter](https://aws.amazon.com/blogs/security/establishing-a-data-perimeter-on-aws/)
* [Building a Data Perimeter Whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/building-a-data-perimeter-on-aws.html)

