import os

# Specify the path to the file
file_path = "C:\Users\pradi\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\LocalCache\local-packages\Python311\site-packages\keras\src\engine\base_layer_utils.py"

# Read the contents of the file
with open(file_path, "r") as file:
    file_contents = file.read()

# Replace the deprecated function with the recommended one
updated_contents = file_contents.replace(
    "tf.executing_eagerly_outside_functions",
    "tf.compat.v1.executing_eagerly_outside_functions"
)

# Write the updated contents back to the file
with open(file_path, "w") as file:
    file.write(updated_contents)
