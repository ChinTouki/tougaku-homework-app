from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_homework import router as homework_router
from app.api.routes_practice import router as practice_router

app = FastAPI(
    title="Tougaku Homework App",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    homework_router,
    prefix="/api",
    tags=["homework"],
)

app.include_router(
    practice_router,
    prefix="/api",
    tags=["practice"],
)
