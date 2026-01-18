import os
import base64
from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ===== Mock 文本（用于 429 / 失败兜底）=====
MOCK_RAW_TEXT = """\
1 + 5 = 6
3 1/3 + 2 = 5 1/3
8 ÷ 2 = 4
6 × 3 = 15
"""

def vision_read(data_url: str) -> str:
    """
    尝试用 Vision 读取图片文字
    成功返回字符串
    失败抛异常
    """
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "请把图片里的算数题目逐行抄写出来。"},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
    )
    return res.choices[0].message.content or ""

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    try:
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode()
        data_url = f"data:{ct};base64,{b64}"
    except Exception as e:
        return {
            "raw_text": MOCK_RAW_TEXT,
            "mock": True,
            "error": f"image_read_error: {str(e)}",
        }

    try:
        text = vision_read(data_url)

        # Vision 成功但返回空，也走 mock
        if not text.strip():
            return {
                "raw_text": MOCK_RAW_TEXT,
                "mock": True,
                "error": "vision_empty_result",
            }

        return {
            "raw_text": text,
            "mock": False,
        }

    except Exception as e:
        # 包括 429 / 任何 OpenAI 异常
        return {
            "raw_text": MOCK_RAW_TEXT,
            "mock": True,
            "error": f"vision_error: {str(e)}",
        }
