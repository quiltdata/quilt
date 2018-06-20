# Copyright 2018, Quilt Data Inc.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#    http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Convenience functions for displaying images in Jupyter notebooks.

`pip install quilt[img]`

Or, in development:
`pip install -e ./[img]`
"""

from math import ceil, floor, sqrt
from six import string_types

import matplotlib.pyplot as plt
import matplotlib.image as mpimg

from quilt.nodes import DataNode, GroupNode

def plot(figsize=(10, 10), limit=100, **kwargs):
    """Display an image [in a Jupyter Notebook] from a Quilt fragment path.
    Intended for use with `%matplotlib inline`.

    Convenience method for looping over supblots that call
    `plt.imshow(image.imread(FILE_PATH))`.

    Keyword arguments
    * figsize=(10, 10) # (HEIGHT_INCHES, WIDTH_INCHES)
    * limit=100 # maximum number of images to display
    * **kwargs - all remaining kwargs are passed to plt.subplots;
      see https://matplotlib.org/api/_as_gen/matplotlib.pyplot.subplots.html
    """
    def _plot(node, paths):
        # assume DataNode with one path; doesn't work with multi-fragment images
        display = [('', paths[0])]
        # for GroupNodes display all DataNode children
        if isinstance(node, GroupNode):
            display = [(x, y._data()) for (x, y) in node._items() if isinstance(y, DataNode)]
            if len(display) > limit:
                print('Displaying {} of {} images...'.format(limit, len(display)))
                display = display[:limit]
        # display can be empty e.g. if no DataNode children
        if len(display) < 1:
            return

        cols = floor(sqrt(len(display)))
        rows = ceil(len(display) / cols)
        plt.subplots(rows, cols, figsize=figsize, **kwargs)

        i = 0
        for dnode in display:
            i += 1
            # don't try to read DataFrames as images
            if isinstance(dnode[1], string_types):
                axes = plt.subplot(rows, cols, i)
                axes.axis('off')
                plt.title(dnode[0])
                try:
                    # throws OSError if file is not a recognizable image
                    bits = mpimg.imread(dnode[1])
                    plt.imshow(bits)
                except OSError as err:
                    print('{}: {}'.format(dnode[0], str(err)))
                    continue 
    return _plot
