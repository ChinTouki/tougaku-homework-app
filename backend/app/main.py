from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_homework_image import router as homework_image_router
# 如果你还有其他 router，可以继续 import

app = FastAPI(
    title="Tougaku Homework API",
    version="1.0.0"
)

# =========================
# CORS 设置（关键）
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tougaku-homework-frontend.onrender.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# 路由注册
# =========================

app.include_router(
    homework_image_router,
    prefix="/api",
    tags=["homework-image"]
)

# （可选）健康检查
@app.get("/")
def root():
    return {"status": "ok"}
