# ===================================================================
# HMPI Predictor from Lat/Lon (Auto Feature Engineering with Fallbacks)
# Author: Rishi
# ===================================================================

import requests
import joblib
import pandas as pd
import numpy as np
from shapely.geometry import Point
import rasterio

# -------------------------------
# Default fallback values (approx from India dataset)
# -------------------------------
DEFAULTS = {
    "dist_to_nearest_industrial_area_km": 5.0,
    "dist_to_nearest_drain_outfall_km": 2.0,
    "dist_to_nearest_landfill_km": 8.0,
    "dist_to_nearest_major_highway_km": 3.0,
    "annual_precip_mm": 1100.0,
    "population_density_per_km2": 450.0,
    "elevation_m": 250.0,
    "land_use_category_estuary": 0,
    "soil_type_clay": 1
}

# -------------------------------
# API utility functions (safe)
# -------------------------------
def get_nearest_distance(lat, lon, query, fallback_key):
    try:
        url = "http://overpass-api.de/api/interpreter"
        r = requests.get(url, params={"data": query}, timeout=15)
        data = r.json()
        coords = []
        for elem in data.get("elements", []):
            if "lat" in elem and "lon" in elem:
                coords.append((elem["lat"], elem["lon"]))
        if not coords:
            return DEFAULTS[fallback_key]
        user_point = Point(lon, lat)
        distances = [user_point.distance(Point(lon2, lat2)) * 111 for lat2, lon2 in coords]
        return min(distances)
    except Exception:
        return DEFAULTS[fallback_key]

def get_elevation(lat, lon):
    try:
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}"
        r = requests.get(url, timeout=10).json()
        return r['results'][0]['elevation']
    except Exception:
        return DEFAULTS["elevation_m"]

def get_rainfall(lat, lon):
    try:
        url = f"https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOT&community=AG&longitude={lon}&latitude={lat}&format=JSON"
        r = requests.get(url, timeout=15).json()
        return r['properties']['parameter']['PRECTOT']['ANN']
    except Exception:
        return DEFAULTS["annual_precip_mm"]

def get_population_density(lat, lon, raster_path="data/worldpop_density.tif"):
    try:
        with rasterio.open(raster_path) as src:
            for val in src.sample([(lon, lat)]):
                return float(val[0])
    except Exception:
        return DEFAULTS["population_density_per_km2"]

# -------------------------------
# Feature builder
# -------------------------------
def build_features(lat, lon, feature_columns):
    features = {
        "latitude": lat,
        "longitude": lon,
        "dist_to_nearest_industrial_area_km": get_nearest_distance(lat, lon, """
            area["ISO3166-1"="IN"][admin_level=2];
            (way["landuse"="industrial"](area););
            out center;
        """, "dist_to_nearest_industrial_area_km"),
        "dist_to_nearest_drain_outfall_km": get_nearest_distance(lat, lon, """
            area["ISO3166-1"="IN"][admin_level=2];
            (way["waterway"="drain"](area););
            out center;
        """, "dist_to_nearest_drain_outfall_km"),
        "dist_to_nearest_landfill_km": get_nearest_distance(lat, lon, """
            area["ISO3166-1"="IN"][admin_level=2];
            (way["landuse"="landfill"](area););
            out center;
        """, "dist_to_nearest_landfill_km"),
        "dist_to_nearest_major_highway_km": get_nearest_distance(lat, lon, """
            area["ISO3166-1"="IN"][admin_level=2];
            (way["highway"~"motorway|trunk|primary"](area););
            out center;
        """, "dist_to_nearest_major_highway_km"),
        "annual_precip_mm": get_rainfall(lat, lon),
        "population_density_per_km2": get_population_density(lat, lon),
        "elevation_m": get_elevation(lat, lon),
        "land_use_category_estuary": DEFAULTS["land_use_category_estuary"],
        "soil_type_clay": DEFAULTS["soil_type_clay"]
    }

    df = pd.DataFrame([features])
    # Align with training feature columns
    for col in feature_columns:
        if col not in df.columns:
            df[col] = 0
    return df[feature_columns]

# -------------------------------
# Prediction function
# -------------------------------
def predict_hmpi(lat, lon):
    model = joblib.load("model/hmpi_predictor_model.pkl")
    feature_columns = joblib.load("model/model_feature_columns.pkl")
    X = build_features(lat, lon, feature_columns)
    return model.predict(X)[0]

# -------------------------------
# Example run
# -------------------------------
if __name__ == "__main__":
    lat, lon = 28.6, 77.2  # Delhi
    print("Predicted HMPI:", predict_hmpi(lat, lon))
