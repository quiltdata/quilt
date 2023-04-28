<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable-next-line first-line-h1 -->
When using the `quilt3` API or CLI with a client-to-site
VPN you may need to trust a custom certificate in Python.

## Mac OS X

1. Direct your browser to an HTTPS website that uses a custom certificate.
1. Click the lock icon in the address bar.
1. Click View certificates and copy the certificate name to a safe place.
1. Open Keychain Access and select System Keychains > System Roots.
1. Click the Certificates tab.
1. Find the certificate that you noted above.
1. Click File > Export Items... to export the root certificate.
1. Convert the exported certificate in Terminal as follows:
    ```sh
    openssl x509 -inform der -in /path/to/your/certificate.cer -out /path/to/converted/certificate.crt
    ```
1. Export the following variable. You may wish to do this in a
startup file for repeatability.
    ```ssh
    export REQUESTS_CA_BUNDLE=/path/to/converted/certificate.crt
    ```

## Linux

1. Export the following variable. You may wish to do this in a
startup file for repeatability.
    ```sh
    export REQUESTS_CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt
    ```

> The single-file version of your CA certificate may be found in
different locations depending upon your operating system.

## Windows

1. Direct your browser to an HTTPS website that uses a custom certificate.
1. Click the lock icon in the address bar.
1. Click View certificates and copy the certificate name to a safe place.
1. Open the Command Prompt («Win + R») and type `certmgr` to open
your Windows Certificate Manager.
1. Find the certificate that you noted above.

   ![MITM certificate](../imgs/certmgr-windows.png)

1. Export the certificate in Base-64 encoded X.509 (.CER) to your
file system (`\Path\To\mycert.cer`).
1. Convert the exported certificate in the Command Prompt as follows
(assumes OpenSSL is installed):
    1.1. Certificate in `der` encoding:
    ```sh
    openssl x509 -inform der -in \Path\To/mycert.cer -out \Path\To\Converted/mycert.crt
    ```
    1.1 Certificate in `pem` encoding (no conversion necessary):
    ```sh
    openssl x509 -in \Path\To/mycert.cer -out \Path\To\Converted/mycert.crt
    ```
1. Export the following variable, which affects the current shell session:
    ```sh
    set REQUESTS_CA_BUNDLE=Path\To\mycert.cer
    ```
1. If using an Anaconda Python distribution, you may wish to permanently define
where Python looks for the custom exported certificate:
    ```sh
    conda config --set ssl_verify \Path\To\Converted/mycert.crt
    ```
This adds a line to `USER_PROFILE\.condarc`:
    ```sh
    ssl_verify: \Path\To\Converted/mycert.crt
    ```

## Verification

`quilt3` should no longer fail with SSL errors related to the custom certificate.

## References

- [SSL certificate verification with Python `Requests`
library](https://requests.readthedocs.io/en/latest/user/advanced/#ssl-cert-verification)
