from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_homework_image import router as homework_image_router

app = FastAPI()

# =========================
# CORS 設定（1回だけ）
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # ← 1回だけ
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Render ヘルスチェック用
# =========================
@app.get("/")
def health_check():
    return {"status": "ok"}

# =========================
# API ルーティング
# =========================
app.include_router(
    homework_image_router,
    prefix="/api",
)
