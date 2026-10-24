# Wind Forecast Desk

A full-stack dashboard for comparing UK wind generation forecasts with actual generation for January 2026 using Elexon BMRS data.

**Live Demo:** https://wind-forecast-hfs5.onrender.com/
**YouTube URL:** https://youtu.be/7uHJo6n9qHI

## Features

- Forecast vs actual generation chart
- Hourly data table and date filters
- MAE, RMSE, bias, and WAPE metrics
- CSV export
- Demo data fallback when the API is unavailable
- Docker build verification through GitHub Actions

## Tech Stack

- Frontend: React, Vite, Recharts
- Backend: Python, FastAPI, pandas
- Data: Elexon BMRS API
- Deployment: Docker, Render, GitHub Actions

## Run Locally

**Using Docker:**

```bash
docker compose up --build
```

Open the URL configured in `docker-compose.yml`.

**Without Docker:**

Start the backend:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment and install dependencies:

```bash
# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

In another terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Data Sources

- Actual generation: Elexon `FUELHH`, filtered for wind.
- Forecast generation: Elexon `WINDFOR`.
- API: https://data.elexon.co.uk/bmrs/api/v1
- Period: 1–31 January 2026 (UTC).

Half-hourly actual generation is aggregated into hourly values to match forecast intervals.

## Metrics

- **MAE:** Mean absolute error.
- **RMSE:** Root mean squared error.
- **Bias:** Mean forecast minus actual; positive values indicate over-forecasting.
- **WAPE:** Total absolute error divided by total actual generation, expressed as a percentage.

Metrics are calculated for matched hourly periods.

## Docker Build

GitHub Actions builds the Docker image on pushes and pull requests targeting `main`, and supports manual runs. The workflow verifies the image build without pushing it to a container registr
.

## AI Usage

ChatGPT and AI assistants were used to support development, debugging, problem-solving, and documentation. AI-generated suggestions were reviewed and tested during implementation.
