import numpy as np
import tensorflow as tf
from sklearn.metrics import confusion_matrix
from time import time

from include.data import get_data_set
from include.model import model

#---------------------------------------------------------------------------
# QUILT SETUP - added after import statements

import quilt.vfs

QUILT_PKG = 'asah/cifar10'

print("Ensuring {} is installed".format(QUILT_PKG))
quilt.vfs.ensure_installed(QUILT_PKG)

print("   reading data from Quilt package: {}...".format(QUILT_PKG))
quilt.vfs.setup(QUILT_PKG, mappings={'data_set/cifar_10':'data_set.cifar_10'})
# disable the custom code (include/data.py) that looks for local input files
quilt.vfs.patch('include.data', 'maybe_download_and_extract', lambda: None)

print("   setting up Tensorflow to read and save checkpoints to/from Quilt...")
quilt.vfs.setup_tensorflow_checkpoints(QUILT_PKG, checkpoints_nodepath='tensorboard/cifar_10')

# END QUILT
#---------------------------------------------------------------------------

train_x, train_y, train_l = get_data_set()
test_x, test_y, test_l = get_data_set("test")

x, y, output, global_step, y_pred_cls = model()

_IMG_SIZE = 32
_NUM_CHANNELS = 3
_BATCH_SIZE = 128
_CLASS_SIZE = 10
_ITERATION = 10000
_SAVE_PATH = "./tensorboard/cifar-10/"


loss = tf.reduce_mean(tf.nn.softmax_cross_entropy_with_logits(logits=output, labels=y))
optimizer = tf.train.RMSPropOptimizer(learning_rate=1e-3).minimize(loss, global_step=global_step)


correct_prediction = tf.equal(y_pred_cls, tf.argmax(y, axis=1))
accuracy = tf.reduce_mean(tf.cast(correct_prediction, tf.float32))
tf.summary.scalar("Accuracy/train", accuracy)


merged = tf.summary.merge_all()
saver = tf.train.Saver()
sess = tf.Session()
train_writer = tf.summary.FileWriter(_SAVE_PATH, sess.graph)


try:
    print("Trying to restore last checkpoint ...")
    last_chk_path = tf.train.latest_checkpoint(checkpoint_dir=_SAVE_PATH)
    saver.restore(sess, save_path=last_chk_path)
    print("Restored checkpoint from:", last_chk_path)
except:
    print("Failed to restore checkpoint. Initializing variables instead.")
    sess.run(tf.global_variables_initializer())


def train(num_iterations):
    '''
        Train CNN
    '''
    for i in range(num_iterations):
        randidx = np.random.randint(len(train_x), size=_BATCH_SIZE)
        batch_xs = train_x[randidx]
        batch_ys = train_y[randidx]

        start_time = time()
        i_global, _ = sess.run([global_step, optimizer], feed_dict={x: batch_xs, y: batch_ys})
        duration = time() - start_time

        if (i_global % 10 == 0) or (i == num_iterations - 1):
            _loss, batch_acc = sess.run([loss, accuracy], feed_dict={x: batch_xs, y: batch_ys})
            msg = "Global Step: {0:>6}, accuracy: {1:>6.1%}, loss = {2:.2f} ({3:.1f} examples/sec, {4:.2f} sec/batch)"
            print(msg.format(i_global, batch_acc, _loss, _BATCH_SIZE / duration, duration))

        if (i_global % 100 == 0) or (i == num_iterations - 1):
            data_merged, global_1 = sess.run([merged, global_step], feed_dict={x: batch_xs, y: batch_ys})
            acc = predict_test()

            summary = tf.Summary(value=[
                tf.Summary.Value(tag="Accuracy/test", simple_value=acc),
            ])
            train_writer.add_summary(data_merged, global_1)
            train_writer.add_summary(summary, global_1)

            saver.save(sess, save_path=_SAVE_PATH, global_step=global_step)
            print("Saved checkpoint.")


def predict_test(show_confusion_matrix=False):
    '''
        Make prediction for all images in test_x
    '''
    i = 0
    predicted_class = np.zeros(shape=len(test_x), dtype=np.int)
    while i < len(test_x):
        j = min(i + _BATCH_SIZE, len(test_x))
        batch_xs = test_x[i:j, :]
        batch_ys = test_y[i:j, :]
        predicted_class[i:j] = sess.run(y_pred_cls, feed_dict={x: batch_xs, y: batch_ys})
        i = j

    correct = (np.argmax(test_y, axis=1) == predicted_class)
    acc = correct.mean()*100
    correct_numbers = correct.sum()
    print("Accuracy on Test-Set: {0:.2f}% ({1} / {2})".format(acc, correct_numbers, len(test_x)))

    if show_confusion_matrix is True:
        cm = confusion_matrix(y_true=np.argmax(test_y, axis=1), y_pred=predicted_class)
        for i in range(_CLASS_SIZE):
            class_name = "({}) {}".format(i, test_l[i])
            print(cm[i, :], class_name)
        class_numbers = [" ({0})".format(i) for i in range(_CLASS_SIZE)]
        print("".join(class_numbers))

    return acc


if _ITERATION != 0:
    train(_ITERATION)


sess.close()
