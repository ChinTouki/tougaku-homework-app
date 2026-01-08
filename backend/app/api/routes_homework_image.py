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


# ======================
# Step 0：是否有学习内容（关键）
# ======================

def has_learning_content(data_url: str) -> bool:
    prompt = """
この画像に「学習内容（文字・数字・記号）」が写っていますか？

【判断基準】
- ひらがな・カタカナ・漢字
- アルファベット
- 数字、計算式、□、線
- 教材・プリント・ノート

机、床、壁、白紙だけの場合は「NO」。

出力（JSONのみ）：
{
  "has_content": true または false
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

    parsed = safe_json_parse(completion.choices[0].message.content)
    return bool(parsed.get("has_content", False))


# ======================
# Step 1：学科强制分类（不允许不明）
# ======================

def classify_subject(data_url: str) -> str:
    prompt = """
次の教科の中から、最も近いものを1つ選んでください。

【選択肢】
- 国語
- 算数
- 英語
- 理科

※ 少しでも当てはまれば必ず1つ選ぶこと
※ 推測でよい

出力（JSONのみ）：
{
  "subject": "国語 | 算数 | 英語 | 理科"
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

    parsed = safe_json_parse(completion.choices[0].message.content)
    return parsed.get("subject", "国語")


# ======================
# Step 2：作业识别
# ======================

def analyze_homework(data_url: str, subject: str) -> dict:
    prompt = f"""
あなたは日本の小学生の{subject}の宿題をチェックする先生です。

【ルール】
- 必ず画像に写っている内容のみを使う
- 読めない部分は「不明」
- 推測は禁止

【出力（JSONのみ）】
{{
  "detected_grade": "小1〜小6 または null",
  "problems": [
    {{
      "id": 1,
      "question_text": "問題文（不明なら '不明'）",
      "child_answer": "子どもの答え（不明なら '不明'）",
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

    return safe_json_parse(completion.choices[0].message.content)


# ======================
# API
# ======================

@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()
    data_url = image_to_data_url(image, img_bytes)

    try:
        # Step 0：是否有学习内容
        if not has_learning_content(data_url):
            return {
                "subject": "不明",
                "detected_grade": None,
                "problems": []
            }

        # Step 1：强制学科分类
        subject = classify_subject(data_url)

        # Step 2：作业识别
        analysis = analyze_homework(data_url, subject)

        return {
            "subject": subject,
            "detected_grade": analysis.get("detected_grade"),
            "problems": analysis.get("problems", [])
        }

    except Exception:
        return {
            "subject": "不明",
            "detected_grade": None,
            "problems": []
        }
