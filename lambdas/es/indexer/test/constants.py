"""
constants for use in testing
"""

NORMAL_EXTRACT = """%matplotlib inline
import keras

from keras.layers         import Dense
from keras.models         import Model
from keras.models         import Sequential
from keras.utils.np_utils import to_categorical

from collections import Counter

import numpy             as np
import matplotlib.pyplot as plt
max_iter = 50
seq_fn   = lambda z, c: z ** 2 + c
def iterate_sequence(seq_fn, max_iter, c):
    return 1 if c.real > 0 else 0
def iterate_sequence(seq_fn, max_iter, c):
    z = c
    for i in range(max_iter):
        z = seq_fn(z, c)
        if (z.real * z.real + z.imag * z.imag) > 4:
            return 1
    return 0
# Model results visualization
def generate_X(unit):
    c_list = []
    width  = 3 * unit
    height = 2 * unit
    
    for x in range(height):
        im = x * 2. / height - 1 
        for y in range(width):
            re = y * 3. / width - 2
            c_list.append(np.array([re, im]))
    
    return np.stack(c_list)
def generate_visualization(model, unit):
    width  = 3 * unit
    height = 2 * unit
    X      = generate_X(unit)
    y      = model.predict_classes(X, batch_size = 64)
    
    return y.reshape((2 * unit, 3 * unit))
class FakeModel():
    def predict_classes(self, X, **kwargs):
        return np.array([iterate_sequence(seq_fn, max_iter, complex(*sample)) for sample in X])
fake_model = FakeModel()
res        = generate_visualization(fake_model, 48)
plt.imshow(res)
# Training samples generation
nb_samples = 100000
samples       = np.random.rand(nb_samples, 2)
samples[:, 0] = samples[:, 0] * 3 - 2
samples[:, 1] = samples[:, 1] * 2 - 1
sample_img = np.array([iterate_sequence(seq_fn, max_iter, complex(*sample)) for sample in samples])
outside = samples[sample_img == 1]
inside  = samples[sample_img == 0][np.random.choice(samples.shape[0] - outside.shape[0], outside.shape[0])] 
X       = np.concatenate([inside, outside])
y       = np.concatenate([np.zeros(inside.shape[0]), np.zeros(outside.shape[0]) + 1]).astype(np.int32)
y       = to_categorical(y)
# Model definition
model = Sequential([
    Dense(512, input_dim = 2, activation = 'relu'),
    Dense(512, activation = 'relu'),
    Dense(512, activation = 'relu'),
    Dense(512, activation = 'relu'),
    Dense(512, activation = 'relu'),
    Dense(512, activation = 'relu'),
    Dense(512, activation = 'relu'),
    Dense(2, activation = 'softmax')
])
model.compile('adam', 'binary_crossentropy')
model.fit(X, y, nb_epoch = 3, batch_size = 256, shuffle = True)
res = generate_visualization(model, 32)
plt.imshow(res)
model.optimizer.lr = 0.0001
model.fit(X, y, nb_epoch = 3, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 3, batch_size = 256, shuffle = True)
plt.imshow(generate_visualization(model, 32))
model.optimizer.lr = 1e-5
model.fit(X, y, nb_epoch = 3, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 3, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 3, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
plt.imshow(generate_visualization(model, 128))
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
model.optimizer.lr = 1e-6
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
plt.imshow(generate_visualization(model, 256))
model.optimizer.lr = 1e-7
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
model.fit(X, y, nb_epoch = 6, batch_size = 256, shuffle = True)
plt.imshow(generate_visualization(model, 256))
"""