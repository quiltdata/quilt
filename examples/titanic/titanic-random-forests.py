import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
pd.options.mode.chained_assignment = None  # quiet pandas warning
from sklearn.externals import joblib

data = pd.read_csv("titanic_train.csv")
expected_output = data[["survived"]]

data["pclass_int"] = data["pclass"].copy()
data["pclass_int"].replace("3rd", 3, inplace = True)
data["pclass_int"].replace("2nd", 2, inplace = True)
data["pclass_int"].replace("1st", 1, inplace = True)
data["sex_bool"] = np.where(data["sex"] == "female", 0, 1)
data["age_float"] = data['age'].copy()
data["age_float"].replace(float('nan'), -1.0, inplace = True)

train_inputs = data[["pclass_int", "age_float", "sex_bool"]]
inputs_train, inputs_test, expected_output_train, expected_output_test   = train_test_split (train_inputs, expected_output, test_size = 0.33, random_state = 42)

rf = RandomForestClassifier (n_estimators=100)

rf.fit(inputs_train, expected_output_train)

accuracy = rf.score(inputs_test, expected_output_test)
print("Accuracy = {}%".format(accuracy * 100))
joblib.dump(rf, "titanic_model1", compress=9)
