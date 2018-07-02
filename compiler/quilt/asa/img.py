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

import matplotlib.image as mpimg
import matplotlib.pyplot as plt

from quilt.nodes import DataNode, GroupNode
from quilt.tools.build import splitext_no_dot

def plot(figsize=(10, 10), formats=None, limit=100, titlelen=10, **kwargs):
    """Display an image [in a Jupyter Notebook] from a Quilt fragment path.
    Intended for use with `%matplotlib inline`.

    Convenience method for looping over supblots that call
    `plt.imshow(image.imread(FILE_PATH))`.

    Keyword arguments
    * figsize=(10, 10) # (HEIGHT_INCHES, WIDTH_INCHES)
    * formats=None # only display images with these extensions
    * limit=100 # maximum number of images to display
    * titlelen=10 # max number of characters in subplot title
    * **kwargs - all remaining kwargs are passed to plt.subplots;
      see https://matplotlib.org/api/_as_gen/matplotlib.pyplot.subplots.html
    """
    # pylint: disable=protected-access
    def _plot(node, paths):
        # assume DataNode with one path; doesn't work with multi-fragment images
        display = [('', paths[0], node._meta)]
        # for GroupNodes display all DataNode children
        if isinstance(node, GroupNode):
            datanodes = [(x, y) for (x, y) in node._items() if isinstance(y, DataNode)]
            display = [(x, y._data(), y._meta) for (x, y) in datanodes]
            if len(display) > limit:
                print('Displaying {} of {} images...'.format(limit, len(display)))
                display = display[:limit]
        # display can be empty e.g. if no DataNode children
        if not display:
            return
        # cast to int to avoid downstream complaints of
        # 'float' object cannot be interpreted as an index
        floatlen = float(len(display)) # so we can ceil
        cols = int(floor(sqrt(floatlen)))
        rows = int(ceil(floatlen/cols))
        plt.tight_layout()
        plt.subplots(rows, cols, figsize=figsize, **kwargs)

        for i, (name, frag, meta) in enumerate(display):
            filepath = meta.get('_system', {}).get('filepath', None)
            # don't try to read DataFrames as images
            if isinstance(frag, string_types) and filepath:
                _, ext = splitext_no_dot(filepath)
                if formats != None and ext.lower() not in (x.lower() for x in formats):
                    continue
                axes = plt.subplot(rows, cols, i + 1) # shift to 1-index
                axes.axis('off')
                plt.title(name[:titlelen] + '...' if len(name) > titlelen else name)
                try:
                    bits = mpimg.imread(frag, format=ext)
                    plt.imshow(bits)
                # Mac throws OSError, Linux IOError if file not recognizable
                except (IOError, OSError) as err:
                    print('{}: {}'.format(name, str(err)))
                    continue 
    return _plot
