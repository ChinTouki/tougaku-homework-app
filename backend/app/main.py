from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_homework, routes_lessons

app = FastAPI(
    title="トウガク しゅくだいパートナー API",
    version="0.1.0",
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_homework.router, prefix="/api", tags=["homework"])
app.include_router(routes_lessons.router, prefix="/api", tags=["lessons"])


@app.get("/health")
async def health():
    return {"status": "ok"}
