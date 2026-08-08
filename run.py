from backend import server as backend_server
from fastapi import FastAPI
from starlette.staticfiles import StaticFiles
import uvicorn
import os

app = FastAPI(title="DineDeskPOS Wrapper")

# Include backend API routes (api_router already has prefix "/api")
app.include_router(backend_server.api_router)

# Mount frontend static files if present
frontend_build = os.path.join(os.getcwd(), "frontend", "build")
if os.path.isdir(frontend_build):
    app.mount("/", StaticFiles(directory=frontend_build, html=True), name="frontend")

# Register backend startup/shutdown handlers so DB/init runs when this app starts
app.add_event_handler("startup", backend_server.startup)
app.add_event_handler("shutdown", backend_server.shutdown_db_client)

if __name__ == "__main__":
    uvicorn.run("run:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), log_level="info")
