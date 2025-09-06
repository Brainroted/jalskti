from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_cors import CORS
import os
from predictor import HMPIPredictor

# -----------------------------
# Absolute paths for templates & assets
# -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, '..', 'templates')  # parent folder
STATIC_DIR = os.path.join(BASE_DIR, '..', 'assets')      # parent folder

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
CORS(app)  # Enable CORS for all routes
app.secret_key = "supersecretkey"  # session ke liye zaruri

# -----------------------------
# Load Predictor Pipeline
# -----------------------------
MODEL_FILE = os.path.join(BASE_DIR, 'model', 'hmpi_predictor_model.pkl')
COLUMNS_FILE = os.path.join(BASE_DIR, 'model', 'model_feature_columns.pkl')

try:
    predictor = HMPIPredictor(MODEL_FILE, COLUMNS_FILE)
    print("✅ Predictor pipeline loaded successfully.")
except Exception as e:
    print(f"❌ Error loading predictor: {e}")
    predictor = None

# -----------------------------
# Login + HTML Routes
# -----------------------------
@app.route('/', methods=['GET', 'POST'])
def route_index():
    if request.method == 'POST':
        username = request.form.get("username")
        password = request.form.get("password")

        if username == "admin" and password == "1234":
            session["user"] = username
            return redirect(url_for("route_dashboard"))
        else:
            return render_template("index.html", error="❌ Invalid credentials")

    return render_template("index.html")  # login form

@app.route('/dashboard')
def route_dashboard():
    if "user" not in session:
        return redirect(url_for("route_index"))
    return render_template('dataentry.html')

@app.route('/analytics')
def route_analytics():
    if "user" not in session:
        return redirect(url_for("route_index"))
    return render_template('analytics.html')

@app.route('/admin')
def route_admin():
    if "user" not in session:
        return redirect(url_for("route_index"))
    return render_template('admin.html')

@app.route('/station')
def route_station():
    if "user" not in session:
        return redirect(url_for("route_index"))
    return render_template('station.html')

@app.route('/logout')
def logout():
    session.pop("user", None)
    return redirect(url_for("route_index"))

# -----------------------------
# API Endpoint
# -----------------------------
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

# -----------------------------
# Main Execution
# -----------------------------
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
