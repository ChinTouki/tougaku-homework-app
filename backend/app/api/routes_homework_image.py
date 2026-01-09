import os
import base64
import json

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class CheckHomeworkImageResponse(BaseModel):
    subject: str
    detected_grade: str | None = None
    problems: list


@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()
    ct = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    data_url = f"data:{ct};base64,{b64}"

    prompt = """
你是一个老师。
请看这张图片并回答。

如果图片中有任何文字或数字：
- 随便选一个学科（国语/算数/英语）
- 写一个简单的示例结果

如果看不到任何学习内容：
- subject 返回 不明
- problems 返回空数组

只返回 JSON，格式如下：
{
  "subject": "国语 | 算数 | 英语 | 不明",
  "detected_grade": null,
  "problems": []
}
"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "只返回JSON"},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    )

    raw = completion.choices[0].message.content

    try:
        return json.loads(raw)
    except Exception:
        return {
            "subject": "不明",
            "detected_grade": None,
            "problems": []
        }
