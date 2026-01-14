import os
import base64
from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()
    ct = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode()
    data_url = f"data:{ct};base64,{b64}"

    prompt = """
你什么都不要判断。

请你只做一件事：
把图片里能看到的文字，逐行原样抄写出来。

要求：
- 不要改写
- 不要合并
- 不要解释
- 看不清就写“？”也可以

直接返回纯文本，每行一行。
"""

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
    )

    text = res.choices[0].message.content or ""

    return {
        "raw_text": text
    }
