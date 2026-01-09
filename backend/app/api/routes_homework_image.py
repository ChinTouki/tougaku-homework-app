import os
import base64
import json
import re

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# =========================
# Response Model
# =========================

class CheckHomeworkImageResponse(BaseModel):
    subject: str
    detected_grade: str | None = None
    problems: list


# =========================
# 安全 JSON 解析（永不抛异常）
# =========================

def safe_parse_json(text: str) -> dict:
    if not text:
        return {}

    try:
        return json.loads(text)
    except Exception:
        # 尝试提取 {...}
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                return {}
        return {}


# =========================
# 学科兜底判定（工程解）
# =========================

def fallback_subject_from_text(text: str) -> str:
    """
    在不依赖 OCR 的情况下，给出一个“永远可用”的学科
    """
    if not text:
        return "算数"

    latin = len(re.findall(r"[A-Za-z]", text))
    kana = len(re.findall(r"[ぁ-んァ-ン一-龯]", text))
    digits = len(re.findall(r"[0-9]", text))

    # 英语优先
    if latin >= 3 and latin > kana:
        return "英语"

    # 算数次之
    if digits >= 2 or re.search(r"[＋\-×÷=]", text):
        return "算数"

    # 日文
    if kana >= 3:
        return "国语"

    # 最终兜底
    return "算数"


# =========================
# API Endpoint
# =========================

@router.post(
    "/check_homework_image",
    response_model=CheckHomeworkImageResponse
)
async def check_homework_image(image: UploadFile = File(...)):
    """
    设计目标：
    - 永远返回 200
    - 永远返回一个 subject
    - 永远不返回“不明”
    """
    try:
        # 读取图片
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{ct};base64,{b64}"

        # Prompt（允许弱推断，MVP 必须）
        prompt = """
あなたは日本の小学生の宿題をチェックする先生です。

【やってほしいこと】
1. 画像を見て、問題文と子どもの答えを読み取る
2. 教科を1つ選ぶ（国語 / 算数 / 英語）
3. 正解かどうかを判断し、短くコメントを書く

【重要】
- 完全に読めなくても、最も可能性が高い内容を推測してよい
- 学習内容が少しでも見える場合は、必ず教科を1つ選ぶ
- 机や白紙の場合のみ、内容がないと判断してよい

【出力ルール】
- 必ず JSON のみを返す
- subject は 国语 / 算数 / 英语 のいずれか

【出力形式】
{
  "subject": "国语 | 算数 | 英语",
  "detected_grade": "小1〜小6 または null",
  "problems": [
    {
      "id": 1,
      "question_text": "問題文",
      "child_answer": "子どもの答え",
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
        parsed = safe_parse_json(raw)

        problems = parsed.get("problems", [])
        all_text = " ".join(
            p.get("question_text", "") + p.get("child_answer", "")
            for p in problems
            if isinstance(p, dict)
        )

        # 后端强制兜底学科
        subject = parsed.get("subject")
        if subject not in ["国语", "算数", "英语"]:
            subject = fallback_subject_from_text(all_text)

        return {
            "subject": subject,
            "detected_grade": parsed.get("detected_grade"),
            "problems": problems if isinstance(problems, list) else [],
        }

    except Exception:
        # 任何异常都不允许影响前端
        return {
            "subject": "算数",
            "detected_grade": None,
            "problems": [],
        }
