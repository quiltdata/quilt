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

import matplotlib.pyplot as plt
import matplotlib.image as mpimg

def plot(figsize=(10, 10), limit=100, **kwargs):
    """Display an image [in a Jupyter Notebook] from a Quilt fragment path.
    Intended for use with `%matplotlib inline`.

    Convenience method for looping over supblots that call
    `plt.imshow(image.imread(FILE_PATH))`.

    Keyword arguments
    * figsize=(10, 10) # (HEIGHT_INCHES, WIDTH_INCHES)
    * limit=100 # maximum number of images to display
    * **kwargs - all remaining kwargs as passed to plt.subplots;
      see https://matplotlib.org/api/_as_gen/matplotlib.pyplot.subplots.html
    """
    def _plot(node, paths):
        display = paths
        if len(paths) > limit:
            print("Displaying {} of {} images...".format(limit, len(paths)))
            display = paths[:limit]

        cols = floor(sqrt(len(display)))
        rows = ceil(len(display) / cols)

        plt.subplots(rows, cols, figsize=figsize, **kwargs)
        i = 1
        for path in display:
            plt.subplot(rows, cols, i)
            plt.imshow(mpimg.imread(path))
            i = i + 1

    return _plot
