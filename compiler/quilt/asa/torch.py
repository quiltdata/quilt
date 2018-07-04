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

"""Present Quilt packages as PyTorch Datasets

`pip install quilt[torch]`

Or, in development:
`pip install -e ./[torch]`
"""

import copy

from torch.utils.data import Dataset

from quilt.nodes import GroupNode

def dataset(
    include=lambda x: True,
    input_transform=None,
    target_transform=None,
    **kwargs):
    """Convert immediate children of a GroupNode into a torch.data.Dataset

    Keyword arguments
    * include=lambda x: True
      lambda(quilt.nodes.GroupNode) => {True, False};
      intended to filter nodes based on metadata

    * input_transform: applied on, and returned, from __getitem__
    * output_transform: applied to copy(item) and returned, from __getitem__
    """
    def _dataset(node, paths):
        return DatasetFromGroupNode(
            node,
            input_transform=input_transform,
            target_transform=target_transform)

    return _dataset

class DatasetFromGroupNode(Dataset):
    def __init__(
        self,
        group,
        include=lambda x: True,
        input_transform=None,
        target_transform=None):

        super(DatasetFromGroupNode, self).__init__()

        if not isinstance(group, GroupNode):
            raise TypeError('Expected GroupNode, got {}, {}', type(group), group)
        if not callable(include):
            raise TypeError('Expected include=callable, got {}, {}', type(include), include)

        self.image_nodes = [x for x in group if include(x)]
        self.input_transform = input_transform
        self.target_transform = target_transform

    def __getitem__(self, index):
        item = self.image_nodes[index]
        # TODO: does this even make sense for GroupNodes?
        target = copy.copy(item)
        if self.input_transform:
            item = self.input_transform(input)
        if self.target_transform:
            target = self.target_transform(target)

        return item, target

    def __len__(self):
        return len(self.image_nodes)
