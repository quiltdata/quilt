import * as React from 'react'
import * as M from '@material-ui/core'

import Dots from 'website/components/Backgrounds/Dots'
import Quotes from 'website/components/Quotes'

import baxley from './people/baxley.jpeg'
import brown from './people/brown.jpeg'
import goldman from './people/goldman.jpeg'
import jackowski from './people/jackowski.jpeg'
import karr from './people/karr.jpeg'
import knaap from './people/knaap.jpeg'
import mrukwa from './people/mrukwa.jpeg'

const testimonials = [
  {
    avatar: jackowski,
    name: 'Krzysztof Jackowski',
    title: 'Deputy Mobile Engineering Manager, Netguru',
    contents: (
      <>
        <p>
          CarLens was the most challenging project I&apos;ve ever worked on. I&apos;ve
          done all the DON&apos;Ts of managing an R&amp;D ML project, learning how
          complicated it is to recognize a car and distinguish which model it is.
        </p>
        <p>
          We&apos;ve learned how important a quality data set us and the way it is
          managed. That&apos;s why we integrated an amazing tool Quilt, which is like
          Github for data. Thanks for presenting this tool to the world.
        </p>
      </>
    ),
  },
  {
    avatar: brown,
    name: 'Jackson Brown',
    title: 'Research Engineer, Allen Institute for Cell Science',
    contents: (
      <p>
        Quilt helps us maximize the dissemination of our data to the scientific community
        by simplifying downloads, allowing data versioning, and seamless integration with
        Jupyter Notebooks.
      </p>
    ),
  },
  {
    avatar: knaap,
    name: 'Eli Knaap',
    title: 'Center for Geospatial Sciences',
    contents: (
      <p>
        Quilt has been an incredibly useful addition to our stack. It lets us focus on
        developing novel spatial analytics while providing a wealth of data for our users
        to apply them on. It also lets us distribute bespoke data products along with our
        code, which is a game-changer, particularly for academic and research software.
      </p>
    ),
  },
  {
    avatar: mrukwa,
    name: 'Grzegorz Mrukwa',
    title: 'Senior Machine Learning Engineer, Netguru',
    contents: (
      <>
        <p>
          Quilt simplified our flow in data maintenance and versioning. It became
          extremely easy to keep track of changes in a data set and refer in a
          reproducible manner to a specific revision without worrying if someone
          overwrites the data.
        </p>
        <p>
          We have Quilt integrated into our flow, so the data set updates interfere with
          model building no more.
        </p>
        <p>
          At this moment we use Quilt for versioning models (especially that we generate
          models in a bunch of formats each time) and Jupyter Notebooks (for which Git
          isn&apos;t the best option).
        </p>
      </>
    ),
  },
  {
    avatar: baxley,
    name: 'Bob Baxley',
    title: 'CTO, Bastille Labs',
    contents: (
      <>
        <p>
          Quilt has been extremely useful in helping Bastille organize our data sets for
          model training. Before Quilt, we used a hodgepodge of S3 buckets and local NAS
          drive locations to store data. But we had issues with versioning and tracking
          data set changes. By referencing data sets through Quilt versions and hashes, it
          is much easier to make immutable analysis notebooks that don&apos;t break as
          data sets evolve.
        </p>
        <p>
          We also love the Quilt web interface, which makes it much easier for the entire
          organization to discover data sets. Before Quilt, our only mechanism to data set
          discovery was listing S3 buckets.
        </p>
      </>
    ),
  },
  {
    avatar: karr,
    name: 'Jonathan Karr',
    title: 'Fellow, Icahn Institute for Data Science at Mount Sinai',
    contents: (
      <>
        <p>
          Along with Git and Docker, Quilt is an essential tool that enables us to
          collaboratively model entire cells.
        </p>
      </>
    ),
  },
  {
    avatar: goldman,
    name: 'Casey Goldman',
    title: 'CEO, Dataland',
    contents: (
      <>
        <p>
          Quilt has been incredibly useful to us in sharing data sets with our clients and
          managing access to them. Quilt handles versioning and packaging with no effort
          on our part, which allows us to be able to share our analysis externally with
          ease.
        </p>
        <p>
          Clients are able to import the transformed data sets into their workflow with
          full portability. Definitely worth trying out!
        </p>
      </>
    ),
  },
]

export default function Testimonials() {
  return (
    <M.Box position="relative">
      <Dots />
      <Quotes quotes={testimonials} />
    </M.Box>
  )
}
