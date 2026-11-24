from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from sqlalchemy.engine import Engine

from .db import create_database_engine
from .seed import initialize_database
from .api import router_for


def create_app(engine: Engine | None = None) -> FastAPI:
    database_engine = engine or create_database_engine()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        initialize_database(database_engine)
        yield
        if engine is None:
            database_engine.dispose()

    app = FastAPI(title="Accountable API", lifespan=lifespan)

    @app.get("/", include_in_schema=False)
    def app_home():
        web_port = os.environ.get("ACCOUNTABLE_WEB_PORT", "5173")
        return RedirectResponse(url=f"http://127.0.0.1:{web_port}/")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    app.include_router(router_for(database_engine))
    return app


app = create_app()
