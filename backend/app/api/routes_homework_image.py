import os
import base64
from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def vision_read(data_url: str, strong: bool = False) -> str:
    prompt = (
        "请你把图片里能看到的文字逐行抄写出来。"
        if not strong else
        "这是一张日本小学生的作业照片。"
        "请尽量读取其中的算数题目和答案，逐行写出。"
        "即使不确定，也请尽量写出看到的内容。"
    )

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
    return res.choices[0].message.content or ""

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    try:
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode()
        data_url = f"data:{ct};base64,{b64}"
    except Exception as e:
        return {"raw_text": "", "error": f"image_read_error: {str(e)}"}

    # 第一次（温和）
    text = vision_read(data_url, strong=False)

    # 第二次（兜底）
    if not text.strip():
        text = vision_read(data_url, strong=True)

    return {
        "raw_text": text
    }
