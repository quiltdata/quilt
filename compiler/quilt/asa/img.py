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

from quilt.tools.const import ELLIPSIS
from quilt.nodes import DataNode, GroupNode
from quilt.tools.build import splitext_no_dot

def plot(figsize=(10, 10), formats=None, limit=100, titlelen=10, **kwargs):
    """Display an image [in a Jupyter Notebook] from a Quilt fragment path.
    Intended for use with `%matplotlib inline`.

    Convenience method that loops over supblots that call
    `plt.imshow(image.imread(FRAG_PATH))`.

    Keyword arguments
    * figsize=(10, 10) # (HEIGHT_INCHES, WIDTH_INCHES)
    * formats=None # List of extensions as strings ['jpg', 'png', ...]
    * limit=100 # maximum number of images to display
    * titlelen=10 # max number of characters in subplot title
    * **kwargs - all remaining kwargs are passed to plt.subplots;
      see https://matplotlib.org/api/_as_gen/matplotlib.pyplot.subplots.html
    """
    # pylint: disable=protected-access
    def _plot(node, paths):
        lower_formats = set((x.lower() for x in formats)) if formats !=None else None
        def node_filter(_, frag, meta):
            filepath = meta.get('_system', {}).get('filepath', None)
            # don't try to read DataFrames as images
            if isinstance(frag, string_types) and filepath:
                _, ext = splitext_no_dot(filepath)
                if formats is None or ext.lower() in lower_formats:
                    return True
            return False
        # assume DataNode has one path; doesn't work with multi-fragment images
        display = [('', paths[0], node._meta)]
        # for GroupNodes, display all DataNode children
        if isinstance(node, GroupNode):
            datanodes = [(x, y) for (x, y) in node._items() if isinstance(y, DataNode)]
            display = [(x, y._data(), y._meta) for (x, y) in datanodes]
            # sort by name so iteration is reproducible (and unit tests pass)
            display = sorted(display, key=lambda rec: rec[0])
            if filter != None:
                # *x to destructure the tuple into individual params
                display = [x for x in display if node_filter(*x)]
            if len(display) > limit:
                print('Displaying {} of {} images{}'.format(limit, len(display), ELLIPSIS))
                display = display[:limit]
        # display can be empty e.g. if no DataNode children
        if not display:
            print('No images to display.')
            return
        # cast to int to avoid downstream complaints of
        # 'float' object cannot be interpreted as an index
        floatlen = float(len(display)) # so we can ceil
        cols = int(floor(sqrt(floatlen)))
        rows = int(ceil(floatlen/cols))
        plt.tight_layout()
        plt.subplots(rows, cols, figsize=figsize, **kwargs)

        for i in range(rows*cols):
            axes = plt.subplot(rows, cols, i + 1) # subplots start at 1, not 0
            axes.axis('off')
            if i < len(display):
                (name, frag, meta) = display[i]
                plt.title(name[:titlelen] + ELLIPSIS if len(name) > titlelen else name)
                filepath = meta.get('_system', {}).get('filepath', None)
                _, ext = splitext_no_dot(filepath)
                try:
                    bits = mpimg.imread(frag, format=ext)
                    plt.imshow(bits)
                # Mac throws OSError, Linux IOError if file not recognizable
                except (IOError, OSError) as err:
                    print('{}: {}'.format(name, str(err)))
                    continue 
    return _plot
