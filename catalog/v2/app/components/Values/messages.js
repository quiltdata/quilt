/* Text for Values component */
import React from 'react';

const strings = {
  machine: 'Machine learning',
  machineDetail: (
    <div>
      <p>
        Store versioned training data and versioned binary models in Quilt.
        Reproduce and share experiments at will.
      </p>
    </div>
  ),
  python: 'Python',
  pythonDetail: (
    <div>
      <p>
        Quilt deeply integrates with Python. Import data packages the same way
        you import code. Get code from pip. Get data from Quilt.
      </p>
    </div>
  ),
  jupyter: 'Jupyter',
  jupyterDetail: (
    <p>
      Quilt makes Jupyter notebooks portable and reproducible.
      &nbsp;<code>quilt install</code> your dependencies and the notebook runs
      on any machine.
    </p>
  ),
  pandas: 'Pandas',
  pandasDetail: (
    <p>
      The <code>pandas.DataFrame</code> is Quilt&#39;s native data structure.
      Save, version, and share pandas data frames in the form of Quilt packages.
    </p>
  ),
};

export default strings;
