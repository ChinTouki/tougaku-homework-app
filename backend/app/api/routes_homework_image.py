import os
import json
import base64
import re
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel, Field
from google.cloud import vision
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
# OCR（Google Vision）
# ======================

def google_ocr_text_with_retry(img_bytes: bytes, max_retry: int = 2) -> str:
    creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if not creds_json:
        raise RuntimeError("Missing Google Vision credentials")

    creds = json.loads(creds_json)
    client_vision = vision.ImageAnnotatorClient.from_service_account_info(creds)

    for attempt in range(max_retry):
        image = vision.Image(content=img_bytes)
        response = client_vision.text_detection(image=image)

        if response.error.message:
            continue

        texts = response.text_annotations
        if texts and texts[0].description:
            text = texts[0].description.strip()

            # ✅ 文字数阈值（经验值）
            if len(text) >= 5:
                return text

        # 如果太短，重试
    return ""



# ======================
# 学科判定（基于真实文字）
# ======================

def infer_subject_from_text(text: str) -> str:
    if not text:
        return "不明"

    latin = len(re.findall(r"[A-Za-z]", text))
    kana = len(re.findall(r"[ぁ-んァ-ン一-龯]", text))
    digits = len(re.findall(r"[0-9]", text))

    if latin >= 3 and latin > kana:
        return "英语"

    if digits >= 2 or re.search(r"[＋\-×÷=]", text):
        return "算数"

    if kana >= 3:
        return "国语"

    return "国语"


# ======================
# API
# ======================

@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()

    try:
        # Step 1：OCR
        text = google_ocr_text_with_retry(img_bytes)

        if not text.strip():
            return {
                "subject": "不明",
                "detected_grade": None,
                "problems": []
            }

        # Step 2：学科判定
        subject = infer_subject_from_text(text)

        # Step 3：LLM 批改（基于 OCR 文本）
        prompt = f"""
你是日本小学生的{subject}老师。

以下是通过OCR读取到的作业文字内容：

{text}

请根据以上文字内容，判断孩子的答案是否正确，并给出：
- 正误
- 简短老师评语
- 提示（不要直接给答案）

输出 JSON：
{{
  "detected_grade": "小1〜小6 或 null",
  "problems": [
    {{
      "id": 1,
      "question_text": "问题",
      "child_answer": "孩子的答案",
      "correct": true 或 false,
      "score": 0.0〜1.0,
      "feedback": "评语",
      "hint": "提示"
    }}
  ]
}}
"""

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": "只返回JSON。"},
                {"role": "user", "content": prompt},
            ],
        )

        parsed = json.loads(completion.choices[0].message.content)

        return {
            "subject": subject,
            "detected_grade": parsed.get("detected_grade"),
            "problems": parsed.get("problems", [])
        }

    except Exception:
        return {
            "subject": "不明",
            "detected_grade": None,
            "problems": []
        }
