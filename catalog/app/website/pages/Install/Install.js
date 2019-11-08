import * as React from 'react'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import Layout from 'website/components/Layout'

import mp from './mp.png'

const MP_LINK =
  'https://aws.amazon.com/marketplace/pp/Quilt-Data-Quilt-Business/B07QF1VXFQ'
const PREREQ_LINK =
  'https://docs.quiltdata.com/references/technical-reference#before-you-install-quilt'
const MAILTO = 'mailto:contact@quiltdata.com'

const useStyles = M.makeStyles((t) => ({
  container: {
    color: t.palette.text.primary,
    maxWidth: 720,
    position: 'relative',
  },
  p: {
    ...t.typography.body1,
    lineHeight: 1.5,
    marginTop: t.spacing(3),
  },
  list: {
    ...t.typography.body1,
    lineHeight: 1.5,
    marginTop: t.spacing(3),
    paddingLeft: '1em',
    '& li': {
      '* + &': {
        marginTop: t.spacing(2),
      },
    },
  },
  marketplace: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(2),
    '& img': {
      maxWidth: 570,
      width: '100%',
    },
  },
}))

function InstallContents() {
  const classes = useStyles()
  const intercom = Intercom.use()
  const contactLink = (children) => {
    const props = intercom.isAvailable()
      ? { onClick: () => intercom('show') }
      : { href: MAILTO }
    return <M.Link {...props}>{children}</M.Link>
  }
  return (
    <M.Container className={classes.container}>
      <M.Box pt={5}>
        <M.Typography variant="h1">Install a private Quilt instance</M.Typography>
      </M.Box>
      <p className={classes.p}>
        The following instructions will guide you through the installation Quilt to your
        own Virtual Private Cloud on AWS as a CloudFormation stack. Once the
        CloudFormation stack is running, your 30-day free trial begins. If you have any
        questions, {contactLink('contact us')}.
      </p>
      <ol className={classes.list}>
        <li>
          Ensure you have <M.Link href={PREREQ_LINK}>the prerequisites</M.Link> ready. Of
          note you will need an AWS account with Administrator access, an S3 bucket, and
          the ability to create DNS entries for your preferred domain (e.g.{' '}
          <code>quilt.your-company.com</code>).
        </li>
        <li>
          <kbd>pip install quilt-stack-installer</kbd>
        </li>
        <li>
          Visit <M.Link href={MP_LINK}>Quilt Business</M.Link> on AWS Marketplace and
          click Continue to Subscribe. You must complete this step in order for your
          installation to function properly.
          <div className={classes.marketplace}>
            <img src={mp} alt="" />
          </div>
        </li>
        <li>
          <kbd>quilt-stack-installer install</kbd>
        </li>
      </ol>
      <p className={classes.p}>
        The <code>quilt-stack-installer</code> utility will walk you through the
        installation. An installation typically takes 30 minutes to complete. Once the
        installation is complete, your 30-day free trial of Quilt begins.
      </p>
      <p className={classes.p}>
        If you have any issues, we&apos;re here to help{' '}
        <M.Link onClick={() => intercom('show')}>over Intercom</M.Link> or{' '}
        <M.Link href={MAILTO}>over email</M.Link>.
      </p>
      <M.Box pt={5} />
    </M.Container>
  )
}

export default function Install() {
  return (
    <Layout>
      <InstallContents />
    </Layout>
  )
}
