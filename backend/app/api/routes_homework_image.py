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


def safe_parse_json(text: str) -> dict:
    """
    永远不会抛异常的 JSON 解析
    """
    if not text:
        return {}

    try:
        return json.loads(text)
    except Exception:
        # 尝试截取 { ... }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                return {}
        return {}


@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(image: UploadFile = File(...)):
    try:
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{ct};base64,{b64}"

        prompt = """
你是一个老师。

请查看图片：
- 如果图片中有学习内容（文字、数字、题目）
  - 随机选择一个教科（国语 / 算数 / 英语）
  - 返回一个简单的 JSON 结果
- 如果看不到学习内容
  - subject 返回 不明
  - problems 返回空数组

只返回 JSON，不要解释。

格式：
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
        parsed = safe_parse_json(raw)

        return {
            "subject": parsed.get("subject", "不明"),
            "detected_grade": parsed.get("detected_grade"),
            "problems": parsed.get("problems", []),
        }

    except Exception as e:
        # ⚠️ 无论发生什么，都不要 500
        return {
            "subject": "不明",
            "detected_grade": None,
            "problems": [],
        }
