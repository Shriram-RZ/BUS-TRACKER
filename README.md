# Bus Tracker

This repository contains the **Bus Tracker** application divided into two main
components:

- **Frontend** (`bus_frontend/`) – a TypeScript/React/Vite client.
- **Backend** (`bustracker_backend/`) – a Python FastAPI service with a MySQL
  database and simulation utilities.

> **Note:** all comments have been removed from the source code as requested.

## Prerequisites

- **Node.js** (v18+ recommended) and `npm`/`yarn` for the frontend.
- **Python** (3.11 or 3.12) and a virtual environment tool (`venv`, `virtualenv`, etc.)
- Git (to clone the repository).

## Getting Started

### Backend Setup

1. Open a terminal and change into the backend folder:
   ```sh
   cd bustracker_backend
   ```
2. Create and activate a virtual environment:
   ```sh
   python -m venv venv        # or python3 if necessary
   source venv/bin/activate   # Linux/macOS
   # venv\Scripts\activate  # Windows (PowerShell)
   ```
3. Install Python dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Initialize the database (MySQL file) using the provided SQL script:
   ```sh
   mysql -u root -p 1234 < setup.sql
   ```
   _You can also use `python database.py` if logic exists to create tables._
5. Start the API server:
   ```sh
   uvicorn main:app --reload
   ```
6. The server listens by default on `http://127.0.0.1:8000`. Open
   `http://127.0.0.1:8000/docs` to view the automatic Swagger UI.

**Useful commands**

- Start the bus simulation (the backend also does this automatically on
  startup):
  ```sh
  # run while the backend is running to keep buses moving
  python simulation.py
  ```
  This helper will launch the same asyncio tasks used by the server and
  then sleep indefinitely. It’s useful when you want to exercise the
  simulation without running the full FastAPI app.
- Access the interactive shell with the environment activated:
  ```sh
  python
  >>> import routes
  ```

### Frontend Setup

1. Move to the frontend directory:
   ```sh
   cd ../bus_frontend
   ```
2. Install JavaScript dependencies:
   ```sh
   npm install            # or yarn
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173` (the default
   Vite port) to view the application.
5. To create a production build, run:
   ```sh
   npm run build
   ```
   The output will be placed in `dist/`.

### Environment Variables

The project currently does not rely on any external services or special
configuration, so no `.env` file is required. If you add one in the future,
store it in the appropriate subdirectory and add it to `.gitignore`.

## Project Structure

```
/ (root)
├── bus_frontend/    # React/Vite client
└── bustracker_backend/  # FastAPI server + Python modules
```

## Running Tests

A basic test suite is provided to verify core functionality. The backend uses
`pytest` along with FastAPI's `TestClient`.

To run the tests:

```sh
# activate the Python virtual environment (see "Backend Setup")
cd bustracker_backend
pip install -r requirements.txt       # ensures pytest is available
pytest                              # run all tests
```

The repository currently contains examples for:

- utility functions (`utils.py`)
- a handful of API endpoints (`routes.py`)

Feel free to expand the `bustracker_backend/tests/` directory with additional
coverage.

## Contribution

Feel free to submit pull requests or open issues. Please maintain the
repository’s coding style and run the development servers locally before
publishing changes.

---

## Appendices

### Appendix A: API Endpoints

- `GET /routes` – list all configured routes
- `GET /buses` – list buses currently registered in the system
- `GET /bus-locations` – fetch live coordinates for every bus; supply
  `user_lat`/`user_lng` query parameters to calculate ETA to the nearest stop
- `POST /search-route` – voice‑oriented search that accepts text like
  "bus from <start> to <end>" and returns the next arriving vehicle

> The Swagger UI at `/docs` exposes the same information interactively.

### Appendix B: Database Schema

- **routes** – stores origin/destination pairs
- **stops** – ordered waypoints belonging to a route
- **buses** – individual vehicles tied to a route and carrying an
  `average_speed_kmph` value
- **bus_locations** – last reported latitude/longitude for each bus (one-to-one)

Refer to `bustracker_backend/models.py` for details.

### Appendix C: Simulation Details

The `simulation.py` module is responsible for periodically updating
`bus_locations` and mimicking real‑world movement. When the application
starts the `lifespan` manager in `main.py` triggers `start_simulation()`.
You can also run the script manually:

```sh
python simulation.py
```

Additional appendices may be added as the project grows.

## License

This project does not include a license file; add one if you intend to share
it publicly.
