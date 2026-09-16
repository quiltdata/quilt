import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'

/**
 * How to read the product from outside the catalog.
 *
 * A product *is* an S3-compatible bucket at the proxy, so this teaches the one
 * call and the address a stock client configures. It renders **no live
 * credentials** and performs no mint: a minted secret on screen is a secret in
 * the clipboard history, and the panel's job is to teach the call rather than to
 * make it.
 *
 * The tier-0 operation list is here because a reader needs to know what will and
 * will not work before they write a script against it. A product is read-only by
 * construction (DEC-50, DEC-51), so there is no write to list.
 */

const useStyles = M.makeStyles((t) => ({
  code: {
    background: t.palette.action.hover,
    display: 'block',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.75rem',
    marginTop: t.spacing(1),
    padding: t.spacing(1.5),
    whiteSpace: 'pre-wrap',
  },
  section: {
    marginTop: t.spacing(3),
  },
}))

export default function Connect({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const workspace = DP.useActiveWorkspace()
  const held = product.holding !== null

  const snippet = [
    'import boto3',
    '',
    '# The registry vends your workspace’s drain-scoped session, then mints',
    '# short-lived credentials against a capture of this product.',
    `creds = mint(scope={"connector": "${product.address.connector}", "volume": "${product.id}"})`,
    '',
    's3 = boto3.client(',
    '    "s3",',
    `    endpoint_url="${product.address.endpoint}",`,
    '    aws_access_key_id=creds["AccessKeyId"],',
    '    aws_secret_access_key=creds["SecretAccessKey"],',
    '    aws_session_token=creds["SessionToken"],',
    '    config=boto3.session.Config(s3={"addressing_style": "path"}),',
    ')',
    `s3.list_objects_v2(Bucket="${product.address.bucket}")`,
  ].join('\n')

  return (
    <M.Box p={3}>
      <M.Typography variant="h6">Connect</M.Typography>

      <div className={classes.section}>
        <M.Typography variant="subtitle2">Address</M.Typography>
        <M.Typography variant="body2" color="textSecondary" component="div">
          Endpoint <code>{product.address.endpoint}</code>
          <br />
          Bucket <code>{product.address.bucket}</code>
          <br />
          Path-style addressing, connector <code>{product.address.connector}</code>
        </M.Typography>
      </div>

      <div className={classes.section}>
        <M.Typography variant="subtitle2">How to mint</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Credentials are minted per session against a capture, and renewal is calling
          mint again. Nothing is shown here: the panel teaches the call, it does not
          perform it.
        </M.Typography>
        <code className={classes.code}>{snippet}</code>
      </div>

      <div className={classes.section}>
        <M.Typography variant="subtitle2">What works through the proxy</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          <code>GetObject</code>, <code>HeadObject</code>, <code>ListObjectsV2</code>,{' '}
          <code>GetBucketLocation</code>. A product is read-only, so there are no writes.
          A product has no packages layer, so there is no <code>quilt3 install</code>.
        </M.Typography>
      </div>

      {!held && (
        <div className={classes.section}>
          {/* The address is public information; the grant is not. Saying so here
              keeps the panel useful on a listing without implying a mint would
              succeed. */}
          <M.Typography variant="body2" color="textSecondary">
            Workspace {workspace} has no subscription to this product, so a mint will not
            succeed until one is approved. The address above does not change.
          </M.Typography>
        </div>
      )}

      <div className={classes.section}>
        <M.Typography variant="caption" color="textSecondary">
          This stack serves no mint yet, so the call above cannot be run here.
        </M.Typography>
      </div>
    </M.Box>
  )
}
