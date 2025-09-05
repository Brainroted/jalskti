# ===================================================================
# Geospatial Heavy Metal Pollution Index (HMPI) Predictor (FINAL)
# Author: Gemini
# Description: This script trains a Random Forest model to predict
#              the HMPI based on environmental and geospatial features
#              from the provided MASTER.csv dataset.
# ===================================================================

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import os # <-- Naya import: File path ke liye zaroori

print("--- HMPI Predictor Script Started ---")

# --- Naya Hissa: Script ka Directory Path Pata Karna ---
# Yeh script ke location ka pata lagata hai taki output files sahi jagah save ho
script_dir = os.path.dirname(os.path.abspath(__file__))
dataset_path = os.path.join(script_dir, 'DATA','MASTER.csv')


# ------------------------------------
# 1. Load and Prepare the Dataset
# ------------------------------------
try:
    df = pd.read_csv(dataset_path)
    print(f"✅ Dataset 'MASTER.csv' loaded successfully. Shape: {df.shape}")
except FileNotFoundError:
    print(f"❌ Error: 'MASTER.csv' not found. Please ensure the file is in the same directory as the script: {script_dir}")
    exit()

# ------------------------------------
# 2. Calculate the Target Variable: HMPI
# ------------------------------------
limits = {
    "Pb_mgL": 0.01, "Cd_mgL": 0.003, "Cr_mgL": 0.05,
    "As_mgL": 0.01, "Ni_mgL": 0.07, "Zn_mgL": 5.0,
    "Cu_mgL": 2.0, "Fe_mgL": 0.3, "Mn_mgL": 0.1
}
metal_cols = list(limits.keys())

df[metal_cols] = df[metal_cols].apply(pd.to_numeric, errors="coerce")

for col in metal_cols:
    median_val = df[col].median()
    df[col] = df[col].fillna(median_val)

weights = {metal: 1 / limit for metal, limit in limits.items()}

def calculate_hmpi(row):
    """Calculates the HMPI for a given row."""
    numerator = sum((row[metal] / limit) * 100 * weights[metal] for metal, limit in limits.items())
    denominator = sum(weights.values())
    return numerator / denominator if denominator > 0 else np.nan

df['HMPI'] = df.apply(calculate_hmpi, axis=1)
df.dropna(subset=['HMPI'], inplace=True)
print("✅ Heavy Metal Pollution Index (HMPI) calculated and set as the target variable.")

# ------------------------------------
# 3. Feature Engineering and Selection
# ------------------------------------
numeric_features = [
    'latitude', 'longitude',
    'dist_to_nearest_industrial_area_km', 'dist_to_nearest_drain_outfall_km',
    'dist_to_nearest_landfill_km', 'dist_to_nearest_major_highway_km',
    'annual_precip_mm', 'population_density_per_km2', 'elevation_m'
]
categorical_features = ['land_use_category', 'soil_type']

df_model = df[numeric_features + categorical_features + ['HMPI']].copy()

# <<< CRITICAL FIX: Convert all numeric columns forcefully, turning any text into NaN
for col in numeric_features:
    df_model[col] = pd.to_numeric(df_model[col], errors='coerce')

# --- Handle Missing Values ---
# Ab yeh stray text se bane NaNs ko bhi theek kar dega
for col in numeric_features:
    df_model[col] = df_model[col].fillna(df_model[col].median())

for col in categorical_features:
    df_model[col] = df_model[col].fillna(df_model[col].mode()[0])

# --- One-Hot Encode Categorical Features ---
df_model = pd.get_dummies(df_model, columns=categorical_features, drop_first=True, dtype=float)
print("✅ Categorical features converted to numerical format (One-Hot Encoding).")

X = df_model.drop('HMPI', axis=1)
y = df_model['HMPI']

X.columns = [str(col) for col in X.columns]
print(f"✅ Feature set prepared. Number of features after encoding: {X.shape[1]}")

# ------------------------------------
# 4. Train-Test Split
# ------------------------------------
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"✅ Data split into training ({X_train.shape[0]} samples) and testing ({X_test.shape[0]} samples).")

# ------------------------------------
# 5. Model Training
# ------------------------------------
model = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1, oob_score=True)
print("⏳ Training the Random Forest model...")
model.fit(X_train, y_train)
print("✅ Model training complete.")

# ------------------------------------
# 6. Model Evaluation
# ------------------------------------
y_pred = model.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)
oob = model.oob_score_

print("\n📊 Model Performance:")
print(f"  - R-squared (R²): {r2:.3f}")
print(f"  - Out-of-Bag (OOB) Score: {oob:.3f}")
print(f"  - Root Mean Squared Error (RMSE): {rmse:.2f}")

# ------------------------------------
# 7. Feature Importance Analysis
# ------------------------------------
importances = model.feature_importances_
feature_names = X.columns
feature_importance_df = pd.DataFrame({'feature': feature_names, 'importance': importances})
feature_importance_df = feature_importance_df.sort_values(by='importance', ascending=False)

plt.style.use('seaborn-v0_8-whitegrid')
fig, ax = plt.subplots(figsize=(12, 10))
sns.barplot(x='importance', y='feature', data=feature_importance_df.head(15), palette='viridis', ax=ax)
ax.set_title('Top 15 Most Important Features for Predicting HMPI', fontsize=16)
ax.set_xlabel('Importance Score', fontsize=12)
ax.set_ylabel('Feature', fontsize=12)
plt.tight_layout()

# --- Sahi Jagah Save Karne Ke Liye Badlav ---
plot_path = os.path.join(script_dir, 'feature_importance.png')
plt.savefig(plot_path, dpi=300)
print(f"\n✅ Feature importance plot saved successfully at: {plot_path}")

# ------------------------------------
# 8. Save the Model for Future Use
# ------------------------------------
# --- Sahi Jagah Save Karne Ke Liye Badlav ---
model_path = os.path.join(script_dir,'model', 'hmpi_predictor_model.pkl')
columns_path = os.path.join(script_dir,'model', 'model_feature_columns.pkl')

joblib.dump(model, model_path)
joblib.dump(list(X.columns), columns_path)
print(f"✅ Model and feature list saved successfully in: {script_dir}")

print("\n--- Script Finished ---")
