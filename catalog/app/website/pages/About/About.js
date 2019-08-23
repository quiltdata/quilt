import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import Backlight1 from 'website/components/Backgrounds/Backlight1'
import Backlight4 from 'website/components/Backgrounds/Backlight4'
import Dots from 'website/components/Backgrounds/Dots'
import Bar from 'website/components/Bar'
import Layout from 'website/components/Layout'

import headAneeshKarve from './team-aneesh-karve.jpg'
import headBenGolub from './team-ben-golub.png'
import headCalvinCochran from './team-calvin-cochran.png'
import headDanWebster from './team-dan-webster.jpeg'
import headDimaRyazanov from './team-dima-ryazanov.jpg'
import headEliCollins from './team-eli-collins.jpg'
import headErniePrabhakar from './team-ernie-prabhakar.jpg'
import headKevinMoore from './team-kevin-moore.jpeg'
import headPankajShah from './team-pankaj-shah.jpg'

const A = M.Link

const P = (props) => <M.Typography color="textSecondary" {...props} />

const Grid = styled(M.Box)(({ theme: t }) => ({
  display: 'grid',
  [t.breakpoints.down('xs')]: {
    gridTemplateColumns: 'auto',
    gridTemplateRows: '200px 36px auto',
    gridTemplateAreas: `
      "head"
      "bar"
      "contents"
    `,
    justifyItems: 'center',
  },
  [t.breakpoints.up('sm')]: {
    gridTemplateColumns: '208px auto',
    gridTemplateRows: '48px auto',
    gridTemplateAreas: `
      ". bar"
      "head contents"
    `,
  },
}))

const TeamMember = ({ name, head, children }) => (
  <Grid mt={10} mx="auto" maxWidth={800}>
    <M.Box
      component="img"
      borderRadius={19}
      src={head}
      alt={name}
      width={160}
      height={160}
      style={{ gridArea: 'head' }}
    />
    <Bar color="primary" style={{ gridArea: 'bar' }} />
    <M.Box style={{ gridArea: 'contents' }}>
      <M.Box mb={3} textAlign={{ xs: 'center', sm: 'left' }}>
        <M.Typography variant="h2" color="textPrimary">
          {name}
        </M.Typography>
      </M.Box>
      {children}
    </M.Box>
  </Grid>
)

const Heading = ({ children }) => (
  <M.Box display="flex" flexDirection="column" alignItems="center" pt={15}>
    <Bar color="secondary" />
    <M.Box mt={5}>
      <M.Typography variant="h1" color="textPrimary">
        {children}
      </M.Typography>
    </M.Box>
  </M.Box>
)

const Team = (props) => (
  <M.Box position="relative" {...props}>
    <Backlight1 />
    <Dots />
    <M.Container maxWidth="lg" style={{ position: 'relative' }}>
      <Heading>Team</Heading>
      <M.Box maxWidth={480} mt={3} mx="auto">
        <M.Typography variant="body1" color="textSecondary" align="center">
          Quilt was founded by Kevin Moore and Aneesh Karve. They have been fast friends
          ever since they met in 2005 as graduate students in Computer Science at
          UW-Madison.
        </M.Typography>
      </M.Box>
      <TeamMember name="Kevin Moore, CEO" head={headKevinMoore}>
        <P>
          <A href="https://www.linkedin.com/in/kevinemoore">Kevin</A> is a computer
          architect. He holds a Ph.D in Computer Science from UW-Madison, where he
          specialized in transactional memory. Kevin worked as a team lead and hardware
          researcher at Sun Microsystems and Oracle Labs. Recently, Kevin was Technologist
          in Residence at <A href="http://unreasonableatsea.com/">Unreasonable At Sea</A>,
          where he collaborated with 11 startups to tackle social and environmental
          challenges, and to refine business models.
        </P>
      </TeamMember>
      <TeamMember name="Aneesh Karve, CTO" head={headAneeshKarve}>
        <P>
          <A href="https://www.linkedin.com/in/aneeshkarve">Aneesh</A> has shipped
          products to millions of users around the globe. He has worked as a{' '}
          <A href="http://www.visualmagnetic.com/">product manager and lead designer</A>{' '}
          at companies like Microsoft, NVIDIA, and Matterport. Aneesh was the general
          manager and founding member of AdJitsu, the first realtime 3D advertising
          platform for iOS,{' '}
          <A href="http://techcrunch.com/2012/05/08/singtels-amobee-buys-adjitsu-to-take-mobile-ads-into-the-third-dimension/">
            acquired by Amobee in 2012
          </A>
          . He holds degrees in chemistry, mathematics, and computer science. Aneesh’s
          research background spans proteomics, machine learning, and algebraic number
          theory.
        </P>
      </TeamMember>

      <TeamMember name="Dima Ryazanov, Sr. Software Engineer" head={headDimaRyazanov}>
        <P>
          <A href="https://www.linkedin.com/in/dimaryazanov/">Dima</A> is a full-stack
          engineer. He kept Gmail and Google Apps running smoothly as a Site Reliability
          Engineer at Google. Dima went on to contribute to the developer API at Dropbox,
          where he also worked on user growth initiatives and optimized web performance.
          In his spare time Dima flies planes.
        </P>
      </TeamMember>
      <TeamMember name="Calvin Cochran, Software Engineer" head={headCalvinCochran}>
        <P>
          Calvin is a full-stack engineer with a background in programming languages,
          runtimes, compilers, and distributed systems. At LogDNA he built a
          high-performance parsing framework for semi-structured strings, and helped
          design a high-throughput, persistent, distributed message transform system. In
          his free time Calvin plays Super Smash Bros. Melee.
        </P>
      </TeamMember>
    </M.Container>
  </M.Box>
)

const Advisors = (props) => (
  <M.Box position="relative" {...props}>
    <Backlight4 />
    <M.Container maxWidth="lg" style={{ position: 'relative' }}>
      <Heading>Advisors</Heading>
      <TeamMember name="Eli Collins" head={headEliCollins}>
        <P>
          <A href="https://www.linkedin.com/in/elidcollins">Eli</A> is Cloudera’s Chief
          Technologist and Vice President of Engineering responsible for Cloudera’s data
          platform (CDH). Prior to joining Cloudera in 2009 he was an engineer at VMware.
          Eli is an active advisor and investor in analytics startups, and holds
          Bachelor’s and Master’s degrees in Computer Science from New York University and
          the University of Wisconsin-Madison, respectively.
        </P>
      </TeamMember>
      <TeamMember name="Ben Golub" head={headBenGolub}>
        <P>
          <A href="https://www.linkedin.com/in/bengolub/">Ben</A> is a serial entrepreneur
          and startup CEO, who is currently an active investor/advisor/board member to
          enterprise startups. Most recently, he was co-founder and CEO of Docker, which
          is known for sparking the containerization revolution and quickly amassing both
          a large community and a rapidly growing base of Global 2000 enterprise
          customers. Prior to Docker, he was CEO of Gluster, which was successfully
          acquired by Red Hat in 2011, and CEO of Plaxo, which was acquired by Comcast in
          2008. Prior to Plaxo, he was EVP/GM of the Security, Payments, and Trust
          division of VeriSign. He currently serves on the boards of a number of
          for-profit and nonprofit boards. Ben holds an MBA/MPP from Harvard and a BA from
          Princeton.
        </P>
      </TeamMember>
      <TeamMember name="Ernie Prabhakar" head={headErniePrabhakar}>
        <P>
          <A href="https://www.linkedin.com/in/drernie/">Dr. Ernie Prabhakar</A> is a
          17-year veteran of Apple Computer, where he drove adoption of UNIX and Open
          Source technologies across Apple’s operating systems and development platforms,
          starting with the launch of Mac OS X Server 1.0 in 1999 to support the original
          iMac. Since leaving Apple in 2014 he has worked with a range of hardware, SaaS
          and social impact startups as a Platform Designer, Product Manager, and Launch
          Manager.
        </P>
      </TeamMember>
      <TeamMember name="Pankaj Shah" head={headPankajShah}>
        <P gutterBottom>
          <A href="https://www.linkedin.com/in/pankajshah2/">Pankaj Shah</A> is an
          investor and advisor to dozens of startups and venture capital firms. He is an{' '}
          <A href="https://angel.co/pankaj-shah-1">early backer</A> of Addepar, ALOHA,
          AltSpace, BuildZoom, OpenGov, VentureBeat, Wish.com and many other companies.
          Pankaj’s advisory roles include FLYR, Kiwi Crate, Meter Feeder, OhMyGreen,
          Parklet, QuanticMind, Quilt, ONEHOPE and uBiome. Pankaj is passionate about
          supporting emerging fund managers scale and, for startups, is most excited about
          the AI, health and food (bio food, CPG and wellness) sectors.
        </P>
        <P gutterBottom>
          His current philanthropic focus is with the{' '}
          <A href="http://www.angio.org/">Angiogenesis Foundation</A> and the{' '}
          <A href="http://www.onehopefoundation.org/">ONEHOPE Foundation</A>. Pankaj is
          also an advocate for Every Mother Counts, Virgin Unite and Witness. Previously,
          he proudly served on the Board of Directors for BRAC USA and{' '}
          <A href="http://www.girlsinc.org/">Girls, Inc</A> and supported{' '}
          <A href="http://musicrising.org/posts/816/celebrity-ipod-auction-benefits-music-rising/">
            Music Rising
          </A>
          . <A href="http://www.brac.net/content/about-brac-usa">BRAC USA</A> aims to end
          extreme poverty in Africa and Asia through innovative, entrepreneurial
          development programs. BRAC is the largest non-profit social enterprise in the
          developing world and focuses on microfinance, health, education, and social
          justice. Girls, Inc., is a national non-profit youth organization dedicated to
          inspiring all girls to be strong, smart and bold.
        </P>
        <P>
          Pankaj has been a guest speaker at a number of top schools, including Columbia
          University, Harvard University, New York University, Stanford University, Tufts
          University and the University of California Haas Graduate School of Business. In
          his occasional spare time, he loves to listen to music, play sports, travel and
          hang out with his kids in Palo Alto.
        </P>
      </TeamMember>
      <TeamMember name="Dan Webster" head={headDanWebster}>
        <P>
          <A href="https://www.linkedin.com/in/dan-webster-522698a4">Dan</A> is a genomics
          researcher by day and developer by night. He holds a Ph.D. in Cancer Biology
          from Stanford, and is currently a Damon Runyon Postdoctoral Fellow at the
          National Cancer Institute. Dan is the creator of{' '}
          <A href="https://www.ohsu.edu/xd/health/services/dermatology/war-on-melanoma/mole-mapper.cfm">
            Mole Mapper
          </A>
          , an iOS app featured by Apple and powered by ResearchKit.
        </P>
      </TeamMember>
    </M.Container>
  </M.Box>
)

export default () => (
  <Layout>
    <Team mb={5} />
    <Advisors mb={15} />
  </Layout>
)
