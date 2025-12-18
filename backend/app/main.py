# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_homework import router as homework_router
# 还有其他 router 就继续 import

app = FastAPI(
    title="Tougaku Homework App",
    version="0.1.0",
)

# ★ CORS 设定：MVP 阶段可以先放开，后面再收紧
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 先全部允许，之后可以改成具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(
    homework_router,
    prefix="/api",
    tags=["homework"],
)

# 如果还有 practice 等路由，也用 include_router 注册
