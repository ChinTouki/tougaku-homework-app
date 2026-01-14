from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_homework_image import router as homework_image_router

app = FastAPI()

# ===== CORS（必须）=====
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tougaku-homework-frontend.onrender.com",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Health Check =====
@app.get("/")
def health_check():
    return {"status": "ok"}

# ===== API =====
app.include_router(
    homework_image_router,
    prefix="/api",
)
