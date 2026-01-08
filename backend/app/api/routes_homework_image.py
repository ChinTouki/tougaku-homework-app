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
    教材/作业友好型学科判定（宽进）
    """
    prompt = """
あなたは日本の小学生の「宿題・教材」の画像を見て、
最も可能性の高い教科を1つだけ選ぶ分類器です。

【重要な考え方】
- 日本の教材は文字が少ない場合があります
- 単語が1〜2個でも学習内容であれば教科を選んでください
- 「完全に分からない」場合のみ「不明」にしてください

【判断ヒント】
- 算数：
  数字、＋−×÷、＝、□、計算の並び、数の図
- 英語：
  アルファベット、英単語、"This / is / a / an" など
  例：dog, apple, run, I am
- 国語：
  ひらがな、カタカナ、漢字、（　　　）や＿＿の空欄
- 理科：
  実験、観察、植物、動物、天気、図と説明文

【出力ルール】
- 学習内容が写っていると判断できる場合は、
  多少あいまいでも最も近い教科を選ぶ
- 机、床、白紙など明らかに学習内容がない場合のみ「不明」

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
