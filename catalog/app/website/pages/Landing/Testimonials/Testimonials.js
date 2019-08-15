import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import styledBy from 'utils/styledBy'

import Bar from 'website/components/Bar'

const avatarGradients = {
  primary: 'linear-gradient(to top, #f1b39d, #f78881)',
  secondary: 'linear-gradient(to top, #5c83ea, #6752e6)',
  tertiary: 'linear-gradient(to top, #c2ead6, #3c85da)',
}

const Avatar = styled(({ children, color, ...props }) => (
  <M.Box
    display="flex"
    alignItems="center"
    justifyContent="center"
    height={80}
    width={80}
    minWidth={80}
    {...props}
  >
    <M.Typography variant="h3" color="textPrimary">
      {children}
    </M.Typography>
  </M.Box>
))({
  borderRadius: '50%',
  background: styledBy('color', avatarGradients),
})

const Testimonial = ({ color, initial, name, children, ...props }) => (
  <M.Box pt={7} display="flex" flexDirection={{ xs: 'column', sm: 'row' }} {...props}>
    <Avatar color={color} mr={{ xs: 0, sm: 5 }} mb={{ xs: 3, sm: 0 }}>
      {initial}
    </Avatar>
    <M.Box>
      <M.Typography variant="h4" color="textPrimary">
        {name}
      </M.Typography>
      <M.Box mt={2}>
        <M.Typography variant="body1" color="textSecondary">
          {children}
        </M.Typography>
      </M.Box>
    </M.Box>
  </M.Box>
)

export default () => (
  <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
    <M.Box pt={10} pb={10}>
      <Bar color="primary" />
      <M.Box mt={5}>
        <M.Typography variant="h1" color="textPrimary">
          Industry endorsements for Quilt
        </M.Typography>
      </M.Box>
      <M.Box>
        <Testimonial
          color="primary"
          initial="JB"
          name="Jackson Brown, Research Engineer, Allen Institute for Cell Science"
        >
          <strong>Global collaboration at terabyte scale</strong>
          <p>
            Quilt helps us maximize the dissemination of our data to the scientific
            community by simplifying downloads, allowing data versioning, and seamless
            integration with Jupyter Notebooks.
          </p>
        </Testimonial>
        <Testimonial
          color="secondary"
          initial="KJ"
          name="Krzysztof Jackowski, Deputy Mobile Engineering Manager, Netguru"
        >
          <strong>Incredible tool for complex ML projects</strong>
          <p>
            CarLens was the most challenging project I&apos;ve ever worked on. I&apos;ve
            done all the DON&apos;Ts of managing an R&D ML project, learning how
            complicated it is to recognize a car and distinguish which model it is.
          </p>
          <p>
            We&apos;ve learned how important a quality data set us and the way it is
            managed. That&apos;s why we integrated an amazing tool Quilt, which is like
            Github for data. Thanks for presenting this tool to the world.
          </p>
          <p>
            <a href="https://www.linkedin.com/feed/update/urn:li:activity:6522466636694458368">
              [Read more on LinkedIn]
            </a>
          </p>
        </Testimonial>
        <Testimonial
          color="secondary"
          initial="EK"
          name="Eli Knaap, Center for Geospatial Sciences"
        >
          <strong>Distribute large, bespoke data</strong>
          <p>
            Quilt has been an incredibly useful addition to our stack. It lets us focus on
            developing novel spatial analytics while providing a wealth of data for our
            users to apply them on. It also lets us distribute bespoke data products along
            with our code, which is a game changer particularly for academic and research
            software.
          </p>
        </Testimonial>
        <Testimonial
          color="secondary"
          initial="GM"
          name="Grzegorz M., Quality Assurance Specialist, Netguru"
        >
          <strong>Missing tool in the ML flow</strong>
          <p>
            Quilt simplified our flow in data maintenance and versioning. It became
            extremely easy to keep track of changes in a dataset and refer in a
            reproducible manner to a specific revision without worrying if someone
            overwrites the data.
          </p>
          <p>
            We have Quilt integrated into our flow, so the dataset updates interfere with
            model building no more.
          </p>
          <p>
            At this moment we use Quilt for versioning models (especially that we generate
            models in a bunch of formats each time) and Jupyter Notebooks (for which Git
            isn&apos;t the best option).
          </p>
          <p>
            What we love most about Quilt is the caching feature. We reduced data transfer
            costs while keeping low complexity of scripts. Overall grade is 5/5 since that
            tool was missing heavily in the flow we had for Machine Learning. At this
            moment we use it also for versioning models (especially that we generate
            models in a bunch of formats each time) and Jupyter Notebooks (for which Git
            isn&apos;t the best option)
          </p>
        </Testimonial>
        <Testimonial
          color="tertiary"
          initial="BB"
          name="Bob Baxley, Chief Engineer, Bastille Labs"
        >
          <strong>Data set versioning, tracking, discovery</strong>
          <p>
            Quilt has been extremely useful in helping Bastille organize our data sets for
            model training. Before Quilt, we used a hodgepodge of S3 buckets and local NAS
            drive locations to store data. But we had issues with versioning and tracking
            data set changes. By referencing data sets through Quilt versions and hashes,
            it is much easier to make immutable analysis notebooks that don&apos;t break
            as data sets evolve.
          </p>
          <p>
            We also love the Quilt web interface, which makes it much easier for the
            entire organization to discover data sets. Before Quilt, our only mechanism to
            dataset discovery was listing S3 buckets.
          </p>
        </Testimonial>
        <Testimonial
          color="tertiary"
          initial="JK"
          name="Jonathan Karr, Fellow, Icahn Institute for Data Science at Mount Sinai"
        >
          <strong>Essential for data collaboration</strong>
          <p>
            Along with Git and Docker, Quilt is an essential tool that enables us to
            collaboratively model entire cells.
          </p>
        </Testimonial>
        <Testimonial color="tertiary" initial="CG" name="Casey Goldman, CEO, Dataland">
          <strong>Great tool for sharing and versioning data sets</strong>
          <p>
            Quilt has been incredibly useful to us in sharing data sets with our clients
            and managing access to them. Quilt handles versioning and packaging with no
            effort on our part, which allows us to be able to share our analysis
            externally with ease.
          </p>
          <p>
            Clients are able to import the transformed data sets into their workflow with
            full portability. Definitely worth trying out!
          </p>
        </Testimonial>
        <Testimonial
          color="tertiary"
          initial="AP"
          name="Anonymous PhD, Awesome company with powerful legal department"
        >
          <strong>Efficient prototyping and sharing with Jupyter</strong>
          <p>
            Before Quilt, I had been serializing and saving data locally while prototyping
            for data analysis not yet ready to be stored in a database. The process of
            sharing a Jupyter notebook with such analysis with colleagues was particularly
            cumbersome, because it involved sending the serialized data along with the
            code, as well as a set of parameters used to acquire it.
          </p>
          <p>
            Quilt was a game changer. I can now save this data in a safe place, version
            controlled, along with metadata which can be used to perform smart searches
            and reliable imports into an analysis notebook.
          </p>
          <p>
            Prototyping data analysis in Jupyter notebooks and Quilt has become much more
            efficient and reliable.
          </p>
        </Testimonial>
      </M.Box>
    </M.Box>
  </M.Container>
)
