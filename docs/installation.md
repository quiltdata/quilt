# Installation

## All platforms
1. Install Python
1. Install `pip`


## Mac OS / Linux
```bash
$ pip install quilt
```


## Windows
Download and install [Visual C++ Redistributable for Visual Studio 2015](https://www.microsoft.com/en-us/download/details.aspx?id=48145).
```bash
$ pip install quilt
```

## Install extras

### [img]
Used by `quilt.asa.plot` to display images in Jupyter notebooks.

```
$ pip install quilt[img]
```

### [pytorch,torchvision]
Used in conjunction with `quilt.asa.pytorch` to generate PyTorch datasets.

#### Mac
```
$ pip install quilt[pytorch,torchvision]
```

#### Linux, Windows
See [pytorch.org](https://pytorch.org/).
