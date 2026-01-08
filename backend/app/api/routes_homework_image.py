import os
import json
import base64
import re
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel, Field
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ======================
# 数据结构
# ======================

class ImageProblemResult(BaseModel):
    id: int
    question_text: str
    child_answer: str
    correct: bool
    score: float = Field(..., ge=0.0, le=1.0)
    feedback: str
    hint: str


class CheckHomeworkImageResponse(BaseModel):
    subject: str
    detected_grade: Optional[str] = None
    problems: List[ImageProblemResult]


# ======================
# 工具
# ======================

def image_to_data_url(image: UploadFile, img_bytes: bytes) -> str:
    ct = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:{ct};base64,{b64}"


def safe_json_parse(text: str) -> dict:
    if not text:
        raise ValueError("empty")

    cleaned = re.sub(r"```json|```", "", text, flags=re.IGNORECASE).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("no json")

    return json.loads(cleaned[start:end + 1])


def infer_subject_from_text(text: str) -> str:
    """
    非常稳定的规则判定（工程解）
    """
    if not text:
        return "不明"

    # 英语：字母占比明显
    latin = len(re.findall(r"[A-Za-z]", text))
    kana = len(re.findall(r"[ぁ-んァ-ン一-龯]", text))
    digits = len(re.findall(r"[0-9]", text))

    if latin >= 3 and latin > kana:
        return "英语"

    # 算数：数字/运算符明显
    if digits >= 2 or re.search(r"[＋\-×÷=]", text):
        return "算数"

    # 国语：日文为主
    if kana >= 3:
        return "国语"

    # 兜底：最常见
    return "国语"


# ======================
# API
# ======================

@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()
    data_url = image_to_data_url(image, img_bytes)

    # ===== Vision Prompt（只做一件事：读内容）=====
    prompt = """
你是一个OCR+老师助手。

【规则】
- 只做一件事：从图片中读取“问题内容”和“孩子的答案”
- 读不到就写“不明”
- 不要判断学科
- 不要举例
- 不要补全

【输出（JSONのみ）】
{
  "detected_grade": "小1〜小6 または null",
  "problems": [
    {
      "id": 1,
      "question_text": "从图片读取到的题目",
      "child_answer": "从图片读取到的孩子答案",
      "correct": true 或 false,
      "score": 0.0〜1.0,
      "feedback": "基于图片内容的简短老师评语",
      "hint": "不直接给答案的提示"
    }
  ]
}
"""

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": "只返回JSON。"},
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
        parsed = safe_json_parse(raw)

        problems = parsed.get("problems", [])
        if not problems:
            return {
                "subject": "不明",
                "detected_grade": None,
                "problems": []
            }

        # 👉 用“读出来的题目文本”稳定判定学科
        all_text = " ".join(
            p.get("question_text", "") for p in problems
        )

        subject = infer_subject_from_text(all_text)

        return {
            "subject": subject,
            "detected_grade": parsed.get("detected_grade"),
            "problems": problems
        }

    except Exception:
        return {
            "subject": "不明",
            "detected_grade": None,
            "problems": []
        }
