# Wind Forecast Desk

A full-stack prototype for reviewing UK national wind generation forecasts and their realised accuracy for January 2026, using Elexon BMRS data.

## Features
- React dashboard with KPI cards, forecast-vs-actual chart, hourly table, and date filtering.
- FastAPI backend that fetches Elexon's FUELHH (half-hourly) and WINDFOR (hourly) stream datasets.
- Half-hourly FUELHH actuals are aggregated to hourly values to match WINDFOR forecast intervals.
- Forecast selection uses the latest forecast published before a configurable day-ahead cutoff (default: 00:00 UTC at the start of the delivery date), avoiding hindsight from later forecast revisions.
- MAE, RMSE, bias, and WAPE metrics calculated only for matched forecast/actual periods.
- Docker Compose setup for local development.
- Demo mode with clearly labelled sample data if the Elexon API is temporarily unavailable.

## Stack
- React + Vite + Recharts
- Python + FastAPI + pandas + requests
- Docker / Docker Compose

## Run locally
Requirements: Docker Desktop.

```bash
docker compose up --build
```

Open http://localhost:8080. API docs: http://localhost:8000/docs.

Without Docker:
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
In another terminal:
```bash
cd frontend
npm install
npm run dev
```
The Vite dev server is configured to proxy `/api` to `http://localhost:8000`.

## Data sources
- Actual generation: `FUELHH` stream, filtered to `fuelType=WIND`.
- Wind forecast: `WINDFOR` stream.
- API base: `https://data.elexon.co.uk/bmrs/api/v1`.
- Requested delivery period: 1–31 January 2026 (UTC).

The API schema and availability can evolve. The backend normalises common field-name variants and returns an explicit error if no matching records are returned. Demo data is visibly labelled and must not be represented as real Elexon observations.

## Metric definitions
- **MAE (MW):** mean of `abs(forecast - actual)`.
- **RMSE (MW):** square root of mean squared error.
- **Bias (MW):** mean of `forecast - actual` (positive means over-forecast).
- **WAPE (%):** sum of absolute errors / sum of actual generation × 100.

Metrics are descriptive for matched hourly periods; they are not a guarantee of future forecast performance. Forecast selection is a prototype day-ahead cutoff convention and should be confirmed with the trading team's actual decision timestamp.

## Deployment
Deploy the frontend to Vercel and the backend to Render (or another Docker-capable host). Set `VITE_API_BASE` to the deployed backend URL if using a separate frontend host, and set backend CORS origins with `CORS_ORIGINS`. For a single-host deployment, the Docker image serves the built frontend via Nginx and proxies `/api` to FastAPI.

A public URL must be created from your own hosting account; this repository does not claim to be deployed until you complete that step and verify it in an incognito window.

## AI use
AI tools were used to assist with scaffolding and documentation. Review and understand the implementation before submission.

## Project structure
```text
backend/
  app/main.py       FastAPI routes, Elexon fetching, joining, metrics
  requirements.txt  Python dependencies
frontend/
  src/App.jsx       Dashboard UI and chart
  src/main.jsx      React entry point
  src/styles.css    Responsive dashboard styling
  index.html        Vite HTML entry point
  nginx.conf        Production static serving and API proxy
Dockerfile          Multi-stage frontend build + Python runtime
docker-compose.yml  Local orchestration
```
