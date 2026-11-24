from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.db import create_database_engine
from app.main import create_app
from app.seed import initialize_database


@pytest.fixture
def fixed_today():
    return date(2026, 11, 24)


@pytest.fixture
def engine(tmp_path, fixed_today):
    database_engine = create_database_engine(tmp_path / "test.db")
    initialize_database(database_engine, seed_today=fixed_today)
    yield database_engine
    database_engine.dispose()


@pytest.fixture
def client(engine):
    with TestClient(create_app(engine)) as test_client:
        yield test_client
