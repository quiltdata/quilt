# Quilt MNIST Example
[//]: # TODO flesh out Quilt catalog entry with attributions, etc. via README.md in package
[MNIST handwriting dataset on Quilt](https://quiltdata.com/package/asah/mnist) and Google's [example classifier](https://www.tensorflow.org/get_started/mnist/beginners) for it.  

## Run the example
```sh
$ pip install tensorflow
$ python3 mnist_softmax.py
/Users/asah/miniconda3/envs/jlab/lib/python3.6/importlib/_bootstrap.py:219: RuntimeWarning: compiletime version 3.5 of module 'tensorflow.python.framework.fast_tensor_util' does not match runtime version 3.6
  return f(*args, **kwds)
Extracting /Users/asah/Library/Application Support/QuiltCli/quilt_packages/objs/440fcabf73cc546fa21475e81ea370265605f56be210a4024d2ca8f203523609
Extracting /Users/asah/Library/Application Support/QuiltCli/quilt_packages/objs/3552534a0a558bbed6aed32b30c495cca23d567ec52cac8be1a0730e8010255c
Extracting /Users/asah/Library/Application Support/QuiltCli/quilt_packages/objs/8d422c7b0a1c1c79245a5bcf07fe86e33eeafee792b84584aec276f5a2dbc4e6
Extracting /Users/asah/Library/Application Support/QuiltCli/quilt_packages/objs/f7ae60f92e00ec6debd23a6088c31dbd2371eca3ffa0defaefb259924204aec6
2017-12-14 04:32:38.470310: I tensorflow/core/platform/cpu_feature_guard.cc:137] Your CPU supports instructions that this TensorFlow binary was not compiled to use: SSE4.1 SSE4.2 AVX
0.9135
```
[//]: # I get a slightly different accuracy... which isn't quite reproducibility :)