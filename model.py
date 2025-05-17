from tensorflow.keras.applications import DenseNet121
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import GlobalAveragePooling2D, Dense
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.regularizers import l1, l2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from sklearn.metrics import confusion_matrix
import os

# Step 1: Define Data Generators
train_dir = 'C:\MAin project\cancer my project\dataset\Train'
test_dir = 'C:\MAin project\cancer my project\dataset\Test'

train_datagen = ImageDataGenerator(
    rescale=1.0/255.0,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
)

test_datagen = ImageDataGenerator(rescale=1.0/255.0)

train_generator = train_datagen.flow_from_directory(
    train_dir,
    target_size=(224, 224),
    batch_size=32,
    class_mode='categorical'
)

validation_generator = test_datagen.flow_from_directory(
    test_dir,
    target_size=(224, 224),
    batch_size=32,
    class_mode='categorical'
)

# Step 2: Define Model Architecture
base_model = DenseNet121(weights='imagenet', include_top=False, input_shape=(224, 224, 3))

model = Sequential([
    base_model,
    GlobalAveragePooling2D(),
    Dense(512, activation='relu', kernel_regularizer=l1(0.0001)),  # L1 regularization
    Dense(9, activation='softmax', kernel_regularizer=l2(0.0001))  # L2 regularization
])

# Adjust the learning rate
learning_rate = 1e-4

# Compile the model with the specified learning rate
model.compile(optimizer=Adam(learning_rate=learning_rate), loss='categorical_crossentropy', metrics=['accuracy'])
# Define the directory path for saving the model
model_dir = 'saved_models'
os.makedirs(model_dir, exist_ok=True)
# Define the file path for saving the model
model_path = os.path.join(model_dir, 'skin_cancer_model1.h5')
# Check if the directory exists before removing the file
if os.path.exists(model_path):
    os.remove(model_path)

# Step 3: Train the Model
history = model.fit(
    train_generator,
    steps_per_epoch=train_generator.samples // 32,
    epochs=50,
    validation_data=validation_generator,
    validation_steps=validation_generator.samples // 32
)

# Step 4: Visualize Training History
plt.figure(figsize=(10, 5))
# Plot training & validation accuracy values
plt.subplot(1, 2, 1)
plt.plot(history.history['accuracy'])
plt.plot(history.history['val_accuracy'])
plt.title('Model Accuracy')
plt.xlabel('Epoch')
plt.ylabel('Accuracy')
plt.legend(['Train', 'Validation'], loc='upper left')

# Plot training & validation loss values
plt.subplot(1, 2, 2)
plt.plot(history.history['loss'])
plt.plot(history.history['val_loss'])
plt.title('Model Loss')
plt.xlabel('Epoch')
plt.ylabel('Loss')
plt.legend(['Train', 'Validation'], loc='upper left')

plt.tight_layout()
plt.show()

# Step 5: Generate a Pie Chart
class_labels = train_generator.class_indices.keys()
class_counts = train_generator.classes
class_distribution = np.bincount(class_counts)

plt.figure(figsize=(8, 8))
plt.pie(class_distribution, labels=class_labels, autopct='%1.1f%%', startangle=140)
plt.title('Class Distribution')
plt.axis('equal')
plt.show()

# Step 6: Generate a Confusion Matrix and Calculate Total Accuracy
# Predict classes for the validation set
y_pred = model.predict(validation_generator)
y_pred_classes = np.argmax(y_pred, axis=1)
y_true = validation_generator.classes

# Calculate total accuracy
total_accuracy = np.sum(y_true == y_pred_classes) / len(y_true)
print("Total Accuracy:", total_accuracy)

# Step 6: Generate a Confusion Matrix
# Predict classes for the test set
y_pred = model.predict(validation_generator)
y_pred_classes = np.argmax(y_pred, axis=1)
y_true = validation_generator.classes

# Calculate confusion matrix
conf_matrix = confusion_matrix(y_true, y_pred_classes)

# Plot confusion matrix
plt.figure(figsize=(8, 6))
sns.heatmap(conf_matrix, annot=True, cmap='Blues', fmt='g')
plt.title('Confusion Matrix')
plt.xlabel('Predicted Label')
plt.ylabel('True Label')
plt.show()

# Step 7: Save the Model
model.save(model_path)
# Print model summary
model.summary()

