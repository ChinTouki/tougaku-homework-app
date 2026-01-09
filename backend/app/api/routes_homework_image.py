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
# API
# ======================

@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()
    ct = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    data_url = f"data:{ct};base64,{b64}"

    prompt = """
あなたは日本の小学生の宿題をチェックする先生です。

【やってほしいこと】
- 画像を見て「教科」を1つ選ぶ（国語 / 算数 / 英語）
- 問題文と子どもの答えを読み取る
- 正解かどうかを判断し、短く説明する

【重要】
- 完全に読めなくても、最も可能性が高い内容を推測してよい
- ただし、机・白紙など学習内容が見えない場合は、その旨を書いてください

【出力ルール】
- JSON だけを返してください
- 教科は必ず 国語 / 算数 / 英語 のいずれか

【出力形式】
{
  "subject": "国語 | 算数 | 英語",
  "detected_grade": "小1〜小6 または null",
  "problems": [
    {
      "id": 1,
      "question_text": "問題文（不明な場合は推測可）",
      "child_answer": "子どもの答え（推測可）",
      "correct": true または false,
      "score": 0.0〜1.0,
      "feedback": "先生のコメント",
      "hint": "ヒント"
    }
  ]
}
"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.3,
        messages=[
            {"role": "system", "content": "必ずJSONだけを返してください。"},
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
        parsed = json.loads(raw)
    except Exception:
        # 最低限の兜底
        return {
            "subject": "算数",
            "detected_grade": None,
            "problems": []
        }

    return {
        "subject": parsed.get("subject", "算数"),
        "detected_grade": parsed.get("detected_grade"),
        "problems": parsed.get("problems", [])
    }
