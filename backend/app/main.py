from datetime import datetime, timezone, timedelta
from typing import Any
import os
import math
import random

import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path as FilePath
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

API = "https://data.elexon.co.uk/bmrs/api/v1"
app = FastAPI(title="Wind Forecast Desk API", version="1.1.0")

origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_time(value: Any):
    """Parse an ISO timestamp and normalize it to UTC."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def value_of(row, *keys):
    for key in keys:
        if row.get(key) is not None:
            return row.get(key)
    return None


def get_rows(dataset: str, publish_from: str, publish_to: str, extra_params=None):
    """
    Fetch a dataset stream using its publication-time window.
    FUELHH and WINDFOR stream endpoints use publishDateTimeFrom/To.
    """
    url = f"{API}/datasets/{dataset}/stream"
    params = {
        "publishDateTimeFrom": publish_from,
        "publishDateTimeTo": publish_to,
    }
    if extra_params:
        params.update(extra_params)

    response = requests.get(url, params=params, timeout=60)
    response.raise_for_status()
    payload = response.json()

    if isinstance(payload, dict):
        payload = payload.get("data", [])

    return payload if isinstance(payload, list) else []


def sample_data():
    """Deterministic illustrative records; never presented as real Elexon data."""
    random.seed(26)
    rows = []
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(31 * 24):
        ts = start + timedelta(hours=i)
        actual = max(
            1500,
            9000 + 4800 * math.sin(i / 24 * math.pi * 2 / 5)
            + random.gauss(0, 1400),
        )
        forecast = max(1200, actual + random.gauss(0, 950))
        publish_time = ts.replace(hour=0, minute=0) - timedelta(days=1)
        rows.append({
            "startTime": ts.isoformat(),
            "actual": round(actual, 1),
            "forecast": round(forecast, 1),
            "publishTime": publish_time.isoformat(),
            "error": round(forecast - actual, 1),
            "source": "illustrative demo data",
        })
    return rows


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "wind-forecast-desk"}


@app.get("/api/forecast")
def forecast_data(
    start: str = Query("2026-01-01T00:00:00Z"),
    end: str = Query("2026-02-01T00:00:00Z"),
    demo: bool = Query(False, description="Use illustrative sample data"),
):
    start_dt = parse_time(start)
    end_dt = parse_time(end)
    if start_dt is None or end_dt is None or start_dt >= end_dt:
        return {
            "rows": [],
            "source": "Elexon BMRS",
            "demo": False,
            "error": "Invalid start/end timestamps. Supply a valid UTC time range.",
        }

    if demo:
        rows = [
            row for row in sample_data()
            if start_dt <= parse_time(row["startTime"]) < end_dt
        ]
        return {
            "rows": rows,
            "source": "illustrative demo data",
            "demo": True,
            "notice": "Sample values are illustrative hourly records, not Elexon observations.",
        }

    try:
        # Request January publication-time records and explicitly request WIND actuals.
        actual_raw = get_rows(
            "FUELHH",
            start_dt.isoformat(),
            end_dt.isoformat(),
            extra_params={"fuelType": "WIND"},
        )

        # Include December publications because a forecast for early January may
        # have been published on the previous day in December.
        forecast_raw = get_rows(
            "WINDFOR",
            "2025-12-01T00:00:00Z",
            end_dt.isoformat(),
        )

        # Aggregate half-hourly FUELHH actuals to hourly values
        # FUELHH is half-hourly (48 periods/day), WINDFOR is hourly (24 periods/day)
        actual_by_hour = {}
        for row in actual_raw:
            fuel = str(value_of(row, "fuelType", "fuel_type", "fuel") or "").upper()
            # API filter is sent above; this second check guards against mixed payloads.
            if fuel and fuel != "WIND":
                continue

            ts = parse_time(value_of(row, "startTime", "start_time"))
            generation = value_of(row, "generation", "quantity")
            if ts is None or generation is None or not (start_dt <= ts < end_dt):
                continue

            try:
                gen_value = float(generation)
            except (TypeError, ValueError):
                continue

            # Truncate to hour (remove minutes) to aggregate half-hourly periods
            hour_ts = ts.replace(minute=0, second=0, microsecond=0)
            if hour_ts not in actual_by_hour:
                actual_by_hour[hour_ts] = []
            actual_by_hour[hour_ts].append(gen_value)

        # Average the half-hourly values within each hour
        actual_by_time = {}
        for hour_ts, values in actual_by_hour.items():
            actual_by_time[hour_ts] = sum(values) / len(values)

        forecasts_by_time = {}
        for row in forecast_raw:
            target = parse_time(value_of(row, "startTime", "start_time"))
            
            published = parse_time(value_of(row, "publishTime", "publish_time"))
            generation = value_of(row, "generation", "quantity")

            if (
                target is None
                or published is None
                or generation is None
                or not (start_dt <= target < end_dt)
            ):
                continue

            # Day-ahead proxy: latest publication before 00:00 UTC on the
            # delivery date. This deliberately excludes same-day revisions.
            cutoff = target.replace(hour=0, minute=0, second=0, microsecond=0)
            if published >= cutoff:
                continue

            try:
                generation_value = float(generation)
            except (TypeError, ValueError):
                continue

            current = forecasts_by_time.get(target)
            if current is None or published > current["published"]:
                forecasts_by_time[target] = {
                    "value": generation_value,
                    "published": published,
                }

        rows = []
        for ts in sorted(set(actual_by_time) & set(forecasts_by_time)):
            forecast = forecasts_by_time[ts]
            actual = actual_by_time[ts]
            rows.append({
                "startTime": ts.isoformat(),
                "actual": actual,
                "forecast": forecast["value"],
                "publishTime": forecast["published"].isoformat(),
                "error": forecast["value"] - actual,
                "source": "Elexon BMRS",
            })

        raw_counts = {
            "actual": len(actual_raw),
            "forecast": len(forecast_raw),
            "actualTimestamps": len(actual_by_time),
            "eligibleForecastTimestamps": len(forecasts_by_time),
            "matched": len(rows),
        }

        if not rows:
            return {
                "rows": [],
                "source": "Elexon BMRS",
                "demo": False,
                "notice": (
                    "No matched records returned. Check API response fields, "
                    "publication coverage, and date ranges."
                ),
                "rawCounts": raw_counts,
            }

        return {
            "rows": rows,
            "source": "Elexon BMRS",
            "demo": False,
            "notice": (
                "Actuals from FUELHH (half-hourly) are aggregated to hourly values "
                "to match WINDFOR (hourly) forecast intervals. "
                "Forecasts use the latest publication before 00:00 UTC on each delivery date."
            ),
            "rawCounts": raw_counts,
        }

    except (requests.RequestException, ValueError, TypeError) as exc:
        return {
            "rows": [],
            "source": "Elexon BMRS",
            "demo": False,
            "error": (
                f"Unable to load upstream data: {type(exc).__name__}. "
                "Retry later or use clearly labelled demo mode."
            ),
        }


@app.get("/api/metrics")
def metrics(
    start: str = "2026-01-01T00:00:00Z",
    end: str = "2026-02-01T00:00:00Z",
    demo: bool = False,
):
    payload = forecast_data(start, end, demo)
    rows = payload.get("rows", [])
    if not rows:
        return {**payload, "metrics": None}

    errors = [row["forecast"] - row["actual"] for row in rows]
    mae = sum(abs(error) for error in errors) / len(errors)
    rmse = math.sqrt(sum(error * error for error in errors) / len(errors))
    total_actual = sum(abs(row["actual"]) for row in rows)
    wape = (
        sum(abs(error) for error in errors) / total_actual * 100
        if total_actual
        else None
    )

    return {
        **payload,
        "metrics": {
            "periods": len(rows),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "bias": round(sum(errors) / len(errors), 2),
            "wape": round(wape, 2) if wape is not None else None,
            "meanActual": round(
                sum(row["actual"] for row in rows) / len(rows), 2
            ),
            "meanForecast": round(
                sum(row["forecast"] for row in rows) / len(rows), 2
            ),
        },
    }


# Serve the compiled frontend from the same container, when available.
_static = FilePath(__file__).resolve().parent.parent / "static"
if _static.exists():
    assets_dir = _static / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    def frontend_index():
        return FileResponse(_static / "index.html")
