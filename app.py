from flask import Flask, render_template, request, redirect, url_for, send_from_directory
import os
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
import numpy as np
from tensorflow.keras.optimizers import Adam

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

# Ensure the upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Load the trained model
# Load the trained model
print("Loading model...")
model = load_model('saved_models/skin_cancer_model1.h5')
print("Model loaded successfully.")

# Print model summary
print(model.summary())

# Create the Adam optimizer with the learning rate specified
optimizer = Adam(learning_rate= 1e-4)

# Compile the model using the optimizer
model.compile(optimizer=optimizer, loss='categorical_crossentropy', metrics=['accuracy'])

# Dummy user database for demonstration
users = {
    'user1': 'password1',
    'user2': 'password2'
}

# Route for the login page
@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        # Check if the username exists and the password is correct
        if username in users and users[username] == password:
            # Redirect to the index page if authentication succeeds
            return redirect(url_for('index'))
        else:
            # Redirect back to the login page with an error message if authentication fails
            return render_template('login.html', error=True)
    return render_template('login.html', error=False)

# Route for the home page
@app.route('/index', methods=['GET'])
def index():
    return render_template('index.html')

# Function to check if the file has an allowed extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Function to preprocess the uploaded image
def preprocess_image(image_path):
    img = image.load_img(image_path, target_size=(224, 224))
    img = image.img_to_array(img)
    img = np.expand_dims(img, axis=0)
    img = img / 255.0  # Normalize pixel values
    return img

# Function to classify the uploaded image
def classify_image(image_path):
    img = preprocess_image(image_path)
    prediction = model.predict(img)
    # Example: Assuming your classes are ['benign', 'malignant']
    class_names = ['actinic keratosis', 'basal cell carcinoma', 'dermatofibroma', 'melanoma', 'nevus', 'pigmented benign keratosis', 'seborrheic keratosis', 'squamous cell carcinoma', 'vascular lesion']
    predicted_class = class_names[np.argmax(prediction)]
    return predicted_class

# Function to determine if the predicted class is benign or malignant
def determine_result_class(predicted_class):
    benign_classes = ['actinic keratosis', 'nevus', 'pigmented benign keratosis', 'seborrheic keratosis']
    return 'Benign' if predicted_class in benign_classes else 'Malignant'

# Route to handle file upload and classification
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'image' not in request.files:
        return redirect(request.url)

    file = request.files['image']

    if file.filename == '':
        return redirect(request.url)

    if file and allowed_file(file.filename):
        filename = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filename)
        predicted_class = classify_image(filename)
        result_class = determine_result_class(predicted_class)
        # Use the correct URL for accessing the uploaded image
        image_url = url_for('uploaded_file', filename=file.filename)
        return render_template('result.html', predicted_class=predicted_class, result_class=result_class, image=image_url)

    return redirect(request.url)

# Route to serve uploaded images
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True)
