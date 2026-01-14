from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_homework_image import router as homework_image_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tougaku-homework-frontend.onrender.com",
        "http://localhost:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "ok"}

app.include_router(
    homework_image_router,
    prefix="/api",
)
