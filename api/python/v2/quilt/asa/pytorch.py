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

`pip install quilt[pytorch]`

Or, in development:
`pip install -e ./[pytorch]`
"""
from torch.utils.data import Dataset

from quilt.nodes import GroupNode

def dataset(
        node_parser,
        include=lambda x: True,
        input_transform=None,
        target_transform=None):
    """Convert immediate children of a GroupNode into a torch.data.Dataset
    Keyword arguments
    * node_parser=callable that converts a DataNode to a Dataset item
    * include=lambda x: True
      lambda(quilt.nodes.GroupNode) => {True, False}
      intended to filter nodes based on metadata
    * input_transform=None; optional callable that takes the item as its argument
    * output_transform=None; optional callable that takes the item as its argument;
      implementation may make its own copy of item to avoid side effects

      Dataset.__getitem__ returns the following tuple
      item = node_parser(node)
      (input_transform(item), output_transform(item))
      Or, if no _transform functions are provided:
      (item, item)
    """
    def _dataset(node, paths): # pylint: disable=unused-argument
        return DatasetFromGroupNode(
            node,
            node_parser=node_parser,
            include=include,
            input_transform=input_transform,
            target_transform=target_transform)

    return _dataset

# pylint: disable=too-few-public-methods
# reason: this interface is baked by torch
class DatasetFromGroupNode(Dataset):
    """Present immediate children of a GroupNode as a torch.dataset"""
    def __init__(
            self,
            group,
            include,
            node_parser,
            input_transform,
            target_transform):

        super(DatasetFromGroupNode, self).__init__()

        if not isinstance(group, GroupNode):
            raise TypeError('Expected group to be GroupNode, got {}', group)
        if not callable(include):
            raise TypeError('Expected include to be callable, got {}', include)

        self.nodes = [x for x in group if include(x)]
        self.node_parser = node_parser
        self.input_transform = input_transform
        self.target_transform = target_transform

    def __getitem__(self, index):
        item = self.node_parser(self.nodes[index])
        target = item
        if self.input_transform:
            item = self.input_transform(item)
        if self.target_transform:
            target = self.target_transform(target)

        return item, target

    def __len__(self):
        return len(self.nodes)
