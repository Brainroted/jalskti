# ===================================================================
# Main Flask Application for RTWQMS-Plus
# Author: Gemini + Updated for Railway Deploy
# Description: Serves HTML pages + API for HMPI prediction using lat/lon only.
# ===================================================================

from flask import Flask, request, jsonify, render_template
import os
from predictor import HMPIPredictor

# ------------------------------------
# 1. App Initialization
# ------------------------------------
app = Flask(__name__,
            template_folder='templates',
            static_folder='assets')

# ------------------------------------
# 2. Load Predictor Pipeline
# ------------------------------------
base_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(base_dir, 'model', 'hmpi_predictor_model.pkl')
COLUMNS_FILE = os.path.join(base_dir, 'model', 'model_feature_columns.pkl')

try:
    predictor = HMPIPredictor(MODEL_FILE, COLUMNS_FILE)
    print("✅ Predictor pipeline loaded successfully.")
except Exception as e:
    print(f"❌ Error loading predictor: {e}")
    predictor = None

# ------------------------------------
# 3. HTML Page Routes
# ------------------------------------
@app.route('/')
def route_index():
    return render_template('index.html')

@app.route('/dashboard')
def route_dashboard():
    return render_template('dataentry.html')

@app.route('/analytics')
def route_analytics():
    return render_template('analytics.html')

@app.route('/admin')
def route_admin():
    return render_template('admin.html')

@app.route('/station')
def route_station():
    return render_template('station.html')

# ------------------------------------
# 4. API Endpoint for ML Prediction
# ------------------------------------
@app.route('/api/predict', methods=['POST'])
def predict_hmpi():
    if predictor is None:
        return jsonify({'error': 'Predictor pipeline not available on server.'}), 500

    try:
        data = request.get_json()
        if not data or "latitude" not in data or "longitude" not in data:
            return jsonify({'error': 'Missing latitude or longitude in request.'}), 400

        lat = float(data["latitude"])
        lon = float(data["longitude"])
        predicted_hmpi = predictor.get_prediction(lat, lon)

        return jsonify({
            'latitude': lat,
            'longitude': lon,
            'predicted_hmpi': predicted_hmpi
        })

    except Exception as e:
        return jsonify({'error': f"Prediction failed: {str(e)}"}), 500

# ------------------------------------
# 5. Main Execution
# ------------------------------------
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # Railway sets PORT automatically
    app.run(host='0.0.0.0', port=port)
