import os
import json
import base64
import re
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form
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
# 工具函数
# ======================

def image_to_data_url(image: UploadFile, img_bytes: bytes) -> str:
    content_type = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:{content_type};base64,{b64}"


def safe_json_parse(text: str) -> dict:
    if not text:
        raise ValueError("empty response")

    cleaned = re.sub(r"```json|```", "", text, flags=re.IGNORECASE).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("no json found")

    return json.loads(cleaned[start:end + 1])


# ======================
# Step 1：学科判定（轻量）
# ======================

def detect_subject(data_url: str) -> str:
    """
    只判断学科，不读题，不判对错
    """
    prompt = """
あなたは画像を見て「教科」だけを判断する分類器です。

【判断基准】
- 英語：アルファベット（A-Z / a-z）、英単語、英文
- 国語：ひらがな・カタカナ・漢字中心の文章
- 算数：数字、＋－×÷、＝、図形、計算式
- 理科：実験、観察、植物・動物・天気などの語

【ルール】
- 画像に学習内容が見当たらない場合は「不明」
- 推測は禁止。見えた内容だけで判断

出力（JSONのみ）：
{
  "subject": "国語 | 算数 | 英語 | 理科 | 不明"
}
"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.0,
        messages=[
            {"role": "system", "content": "JSONのみを返してください。"},
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
    return parsed.get("subject", "不明")


# ======================
# Step 2：作业识别（仅在学科明确时）
# ======================

def analyze_homework(data_url: str, subject: str) -> dict:
    prompt = f"""
あなたは日本の小学生の{subject}の宿題をチェックする先生です。

【最重要ルール】
- 必ず画像に写っている内容のみを使う
- 読めない内容は「不明」と書く
- 推測・補完は禁止

【出力形式（JSONのみ）】
{{
  "detected_grade": "小1〜小6 または null",
  "problems": [
    {{
      "id": 1,
      "question_text": "画像から読み取れた問題文（不明なら '不明'）",
      "child_answer": "画像から読み取れた答え（不明なら '不明'）",
      "correct": true または false,
      "score": 0.0〜1.0,
      "feedback": "短い先生コメント",
      "hint": "答えを直接言わないヒント"
    }}
  ]
}}
"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.2,
        messages=[
            {"role": "system", "content": "JSONのみを返してください。"},
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
    return safe_json_parse(raw)


# ======================
# API Endpoint
# ======================

@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(
    image: UploadFile = File(...)
):
    img_bytes = await image.read()
    data_url = image_to_data_url(image, img_bytes)

    try:
        # Step 1：判定学科
        subject = detect_subject(data_url)

        if subject == "不明":
            return {
                "subject": "不明",
                "detected_grade": None,
                "problems": []
            }

        # Step 2：识别作业
        analysis = analyze_homework(data_url, subject)

        return {
            "subject": subject,
            "detected_grade": analysis.get("detected_grade"),
            "problems": analysis.get("problems", [])
        }

    except Exception:
        # 任何异常都安全返回
        return {
            "subject": "不明",
            "detected_grade": None,
            "problems": []
        }
