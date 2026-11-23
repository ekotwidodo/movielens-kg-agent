"""Application entry point.

Run with:
    uvicorn main:app --host 127.0.0.1 --port 8000 --reload
or:
    python main.py
"""

from backend.api import create_app

# FastAPI application instance for Uvicorn
app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
