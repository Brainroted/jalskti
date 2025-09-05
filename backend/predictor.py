# ===================================================================
# HMPI Predictor from Lat/Lon (Auto Feature Engineering with Fallbacks)
# Author: Rishi + Updated to Class-based OOP
# ===================================================================

import requests
import joblib
import pandas as pd
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
# Utility Functions (internal)
# -------------------------------
def _get_nearest_distance(lat, lon, query, fallback_key):
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

def _get_elevation(lat, lon):
    try:
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}"
        r = requests.get(url, timeout=10).json()
        return r['results'][0]['elevation']
    except Exception:
        return DEFAULTS["elevation_m"]

def _get_rainfall(lat, lon):
    try:
        url = f"https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOT&community=AG&longitude={lon}&latitude={lat}&format=JSON"
        r = requests.get(url, timeout=15).json()
        return r['properties']['parameter']['PRECTOT']['ANN']
    except Exception:
        return DEFAULTS["annual_precip_mm"]

def _get_population_density(lat, lon, raster_path="data/worldpop_density.tif"):
    try:
        with rasterio.open(raster_path) as src:
            for val in src.sample([(lon, lat)]):
                return float(val[0])
    except Exception:
        return DEFAULTS["population_density_per_km2"]

# -------------------------------
# Class-based Predictor
# -------------------------------
class HMPIPredictor:
    def __init__(self, model_path, columns_path):
        self.model = joblib.load(model_path)
        self.feature_columns = joblib.load(columns_path)

    def build_features(self, lat, lon):
        features = {
            "latitude": lat,
            "longitude": lon,
            "dist_to_nearest_industrial_area_km": _get_nearest_distance(lat, lon, """
                area["ISO3166-1"="IN"][admin_level=2];
                (way["landuse"="industrial"](area););
                out center;
            """, "dist_to_nearest_industrial_area_km"),
            "dist_to_nearest_drain_outfall_km": _get_nearest_distance(lat, lon, """
                area["ISO3166-1"="IN"][admin_level=2];
                (way["waterway"="drain"](area););
                out center;
            """, "dist_to_nearest_drain_outfall_km"),
            "dist_to_nearest_landfill_km": _get_nearest_distance(lat, lon, """
                area["ISO3166-1"="IN"][admin_level=2];
                (way["landuse"="landfill"](area););
                out center;
            """, "dist_to_nearest_landfill_km"),
            "dist_to_nearest_major_highway_km": _get_nearest_distance(lat, lon, """
                area["ISO3166-1"="IN"][admin_level=2];
                (way["highway"~"motorway|trunk|primary"](area););
                out center;
            """, "dist_to_nearest_major_highway_km"),
            "annual_precip_mm": _get_rainfall(lat, lon),
            "population_density_per_km2": _get_population_density(lat, lon),
            "elevation_m": _get_elevation(lat, lon),
            "land_use_category_estuary": DEFAULTS["land_use_category_estuary"],
            "soil_type_clay": DEFAULTS["soil_type_clay"]
        }

        df = pd.DataFrame([features])
        # Align with training feature columns
        for col in self.feature_columns:
            if col not in df.columns:
                df[col] = 0
        return df[self.feature_columns]

    def get_prediction(self, lat, lon):
        X = self.build_features(lat, lon)
        return round(float(self.model.predict(X)[0]), 2)


# -------------------------------
# Example run (for testing standalone)
# -------------------------------
if __name__ == "__main__":
    MODEL_FILE = "model/hmpi_predictor_model.pkl"
    COLUMNS_FILE = "model/model_feature_columns.pkl"
    predictor = HMPIPredictor(MODEL_FILE, COLUMNS_FILE)
    print("Predicted HMPI for Delhi:", predictor.get_prediction(28.6, 77.2))
