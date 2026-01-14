import os
import base64
from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()

# OpenAI client（注意：不在 import 时失败）
def get_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    """
    终极止血版：
    - 任何异常都不会导致 500
    - 永远返回 200
    - 返回 raw_text 供前端调试
    """
    try:
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode()
        data_url = f"data:{ct};base64,{b64}"
    except Exception as e:
        return {
            "raw_text": "",
            "error": f"image_read_error: {str(e)}"
        }

    try:
        client = get_client()

        res = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "请你什么都不要判断，只做一件事：\n"
                                "把图片里能看到的文字逐行原样抄写出来。\n"
                                "不要解释，不要改写。"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                }
            ],
        )

        text = res.choices[0].message.content or ""

        return {
            "raw_text": text
        }

    except Exception as e:
        # ⚠️ 关键：这里绝不 raise
        return {
            "raw_text": "",
            "error": f"openai_error: {str(e)}"
        }
