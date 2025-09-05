# ===================================================================
# Main Flask Application for RTWQMS-Plus
# Author: Gemini
# Description: This server handles page rendering and the ML prediction API.
# ===================================================================

from flask import Flask, request, jsonify, render_template
import pandas as pd
import joblib
import os

# ------------------------------------
# 1. App Initialization
# ------------------------------------

# Initialize the Flask app.
# We explicitly tell Flask where to find the HTML templates and the static files.
app = Flask(__name__, 
            template_folder='templates', 
            static_folder='assets')

# ------------------------------------
# 2. Load ML Model and Assets
# ------------------------------------

# Define the path to the model folder
model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model')
model_path = os.path.join(model_dir, 'hmpi_predictor_model.pkl')
columns_path = os.path.join(model_dir, 'model_feature_columns.pkl')

# Load the assets once when the server starts
try:
    model = joblib.load(model_path)
    model_columns = joblib.load(columns_path)
    print("✅ Model and feature columns loaded successfully.")
except FileNotFoundError:
    print(f"❌ Error: Model files not found in '{model_dir}'. Please run train_model.py first.")
    model = None
    model_columns = None

# ------------------------------------
# 3. HTML Page Rendering Routes
# ------------------------------------

# These routes simply serve your HTML pages.

@app.route('/')
def route_index():
    """Serves the login page (index.html)."""
    return render_template('index.html')

@app.route('/dashboard')
def route_dashboard():
    """Serves the main data entry dashboard page."""
    return render_template('dataentry.html')

@app.route('/analytics')
def route_analytics():
    """Serves the analytics page."""
    return render_template('analytics.html')

@app.route('/admin')
def route_admin():
    """Serves the admin page."""
    return render_template('admin.html')

@app.route('/station')
def route_station():
    """Serves the station details page."""
    # In a real app, you would fetch the station ID from the request
    # e.g., @app.route('/station/<int:station_id>')
    return render_template('station.html')

# ------------------------------------
# 4. API Endpoint for ML Prediction
# ------------------------------------

@app.route('/api/predict', methods=['POST'])
def predict_hmpi():
    """Receives data from the frontend and returns an HMPI prediction."""
    
    # Check if the model was loaded successfully
    if model is None or model_columns is None:
        return jsonify({'error': 'ML model is not available on the server.'}), 500

    try:
        # Get the JSON data sent from the frontend
        json_data = request.get_json()
        
        # Convert the single JSON object into a Pandas DataFrame
        input_df = pd.DataFrame([json_data])

        # One-hot encode the categorical features
        input_df_encoded = pd.get_dummies(input_df)

        # Reindex the dataframe to match the training columns
        # This ensures all required columns are present and in the correct order
        final_df = input_df_encoded.reindex(columns=model_columns, fill_value=0)
        
        # Make the prediction
        prediction = model.predict(final_df)
        
        # Format the response and send it back to the frontend
        response = {'predicted_hmpi': round(prediction[0], 2)}
        return jsonify(response)

    except Exception as e:
        # Return a detailed error if something goes wrong
        return jsonify({'error': f"An error occurred during prediction: {str(e)}"}), 400

# ------------------------------------
# 5. Main Execution Block
# ------------------------------------

if __name__ == '__main__':
    # Run the Flask app
    # host='0.0.0.0' makes it accessible on your local network
    app.run(host='0.0.0.0', port=5000, debug=True)
