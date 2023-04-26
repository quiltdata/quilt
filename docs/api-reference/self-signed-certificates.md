<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable-next-line first-line-h1 -->
When using the `quilt3` API or CLI with a client-to-site
VPN you may need to trust a custom certificate in Python.

## Mac OS X

1. Direct your browser to an HTTPS website that uses the custom certificate.
2. Click the lock icon in the address bar.
3. Click View certificates and copy the certificate name to a safe place.
1. Open Keychain Access and select System Keychains > System Roots
6. Click the Certificates tab.
7. Find the certificate that you noted above
8. Click File > Export Items... to export the root certificate.
9. Convert the exported certificate in Terminal as follows:
    ```sh
    openssl x509 -inform der -in /path/to/your/certificate.cer -out /path/to/converted/certificate.crt
    ```
10. In the Terminal, open your shell profile (e.g. `~/.bashrc` or
`~/.zshrc`).
11. Add the certificate to your shell environment:
    ```ssh
    export REQUESTS_CA_BUNDLE=/path/to/converted/certificate.crt`
    ```

## Linux

1. Open your shell profile (e.g. `~/.bashrc` or `~/.zshrc`).
2. Add the single-file version of CA certificates to your shell environment:
    ```sh
    export REQUESTS_CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt`
    ```
3. Save the change.
3. Exit your shell, then reopen.

> The single-file version of CA certificates may be located elsewhere
in different Linux distributions. For example, in Ubuntu Linux
distributions the file is located at `/etc/ssh/certs/ca-certificates.crt`

## Windows

1. Open a new browser window and navigate to any HTTPS website.
2. Click the «lock icon» in the browser navigation/address bar.
3. Click «View certificates» and record the `Issued by` value (e.g.
`mycert`).
4. Open the Command Prompt («Win + R») and type `certmgr`. This
opens the Windows Certificate Manager for the current user.
5. Search all certificates stores for a certificate `Issued by` value
that equals the value recorded (`mycert` in the example).

   ![MITM certificate](../imgs/certmgr-windows.png)

6. Export the certificate in Base-64 encoded X.509 (.CER) to your
file system (`Path\To\mycert.cer`).
7. Add the certificate to your localhosts list of trusted CA's via the
`REQUESTS_CA_BUNDLE` environment variable:
    ```sh
    > set REQUESTS_CA_BUNDLE=Path\To\mycert.cer
    ```
> This only affects the current shell session.

## Verification

Requesting access to a registry with the `quilt3` API or CLI should
no longer fail with SSL errors.

## Further information

- [SSL certificate verification with Python `Requests`
library](https://requests.readthedocs.io/en/latest/user/advanced/#ssl-cert-verification)
