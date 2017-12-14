# Quilt IMDB Example

The famous [IMDB reviews dataset](https://keras.io/datasets/#imdb-movie-reviews-sentiment-classification) ([Quilt repository copy](https://quiltdata.com/package/asah/imdb_keras)) and the keras [example classifier](https://github.com/keras-team/keras/blob/master/examples/imdb_lstm.py) for it.  

To run, `python imdb_lstm.py`.

Output should look like this:
```sh
$ python imdb_lstm.py
Using TensorFlow backend.
/Users/asah/miniconda3/envs/jlab/lib/python3.6/importlib/_bootstrap.py:219: RuntimeWarning: compiletime version 3.5 of module 'tensorflow.python.framework.fast_tensor_util' does not match runtime version 3.6
  return f(*args, **kwds)
Loading data...
25000 train sequences
25000 test sequences
Pad sequences (samples x time)
x_train shape: (25000, 80)
x_test shape: (25000, 80)
Build model...
Train...
Train on 25000 samples, validate on 25000 samples
Epoch 1/15
2017-12-14 06:30:07.097585: I tensorflow/core/platform/cpu_feature_guard.cc:137] Your CPU supports instructions that this TensorFlow binary was not compiled to use: SSE4.1 SSE4.2 AVX
  384/25000 [..............................] - ETA: 3:21 - loss: 0.6926 - acc: 0.5078
```
