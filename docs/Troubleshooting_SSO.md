<!-- markdownlint-disable MD013 -->
# Troubleshooting Guide: SSO Redirect Loop Issues

## Overview

This guide helps customers diagnose and resolve **SSO login redirect loop** issues when using **Microsoft Azure, Google Workspace, or Okta** for authentication.

## Step 1: Verify Redirect URIs

Incorrect redirect URIs are a common cause of SSO loops.

- **Azure**: Go to **Azure AD > Enterprise Applications > [Your Application] > Authentication**.
- **Google**: Go to **Google Admin Console > Security > Set up single sign-on (SSO)**.
- **Okta**: Go to **Okta Admin > Applications > [Your App] > Sign On**.

Ensure the **redirect URI** matches exactly what is expected,
as documented in the Quilt [technical reference](https://docs.quilt.bio/quilt-platform-administrator/technical-reference#single-sign-on-sso).
This includes:

- Case sensitivity (Azure and Okta are case-sensitive!)
- Proper `https://` scheme
- Trailing slashes (if required)

Double-check the **Logout URL**, as incorrect values can cause infinite redirects.

## Step 2: Review SSO Provider Sign-In Logs

SSO provider logs can help pinpoint misconfigurations.

1. **Azure**: Navigate to **Azure AD > Enterprise Applications > [Your Application] > Sign-In Logs**.
2. **Google**: Go to **Google Admin Console > Reports > Audit > SAML**.
3. **Okta**: Go to **Okta Admin > System Log**.

Look for failed sign-ins and error codes:

- **AADSTS50011 (Azure)**: Redirect URI mismatch.
- **AADSTS50008 (Azure)**: Invalid token signature.
- **AADSTS50105 (Azure)**: User is not assigned to the app.
- **403 or 400 errors (Google/Okta)**: Often indicate incorrect redirect URIs or token issues.

## Step 3: Inspect Browser Network Requests

Use browser DevTools (F12) to examine the authentication flow:

- Open the **Network tab** before attempting to log in.
- Filter requests by `sso`, `redirect`, or `login`.
- Look for repeated requests to the same URL, indicating a loop.
- Click on the **Request/Response Headers** to check error messages.

## Step 4: Verify Token Claims (SAML or OIDC)

Incorrect claims or missing attributes can cause authentication failures.

- If using **SAML**, use **SAML-tracer (Firefox)** or **Fiddler** to inspect assertions.
- If using **OIDC**, paste the ID token into [jwt.io](https://jwt.io/) or [jwt.ms](https://jwt.ms/) to check claims.
- Ensure the **issuer (iss)** and **audience (aud)** claims match what the application expects.

## Step 5: Collect CloudWatch Logs for ECS

Follow the usual [troubleshooting steps](https://docs.quilt.bio/quilt-python-sdk/more/troubleshooting#elastic-container-service-ecs) to collect the ECS logs for the registry service:

- Look for authentication-related errors or unexpected redirects.
- Verify that the expected redirect URIs are being returned.

## Common Fixes

| Issue                         | Possible Fix                                             |
| ----------------------------- | -------------------------------------------------------- |
| Redirect loop after login     | Verify redirect URIs and logout URL in Azure/Google/Okta |
| Authentication fails silently | Check SSO provider logs for error codes                  |
| Incorrect token claims        | Ensure the ID token contains the expected claims         |
| User not authorized           | Assign the user to the SSO Enterprise App                |
| Invalid signature error       | Confirm the correct token signing algorithm is used      |

## Next Steps

If the issue persists after these checks, provide the following information to your support team:

1. SSO Provider Sign-In Logs with error codes.
2. Browser Network logs (HAR file) showing redirects.
3. SAML assertion (if applicable) or decoded OIDC token.
4. ECS logs from the registry.

Following these steps should help you diagnose and resolve most SSO redirect loop issues efficiently across Azure, Google, and Okta.
