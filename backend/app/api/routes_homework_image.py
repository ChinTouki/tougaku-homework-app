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
# 工具函数
# ======================

def image_to_data_url(image: UploadFile, img_bytes: bytes) -> str:
    content_type = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:{content_type};base64,{b64}"


def safe_json_parse(text: str) -> dict:
    """
    容错 JSON 解析，允许 ```json```、前后多余文字
    """
    if not text:
        raise ValueError("empty response")

    cleaned = re.sub(r"```json|```", "", text, flags=re.IGNORECASE).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("no json found")

    return json.loads(cleaned[start:end + 1])


# ======================
# 单阶段 Vision（学科 + 作业一起）
# ======================

@router.post(
    "/check_homework_image",
    response_model=CheckHomeworkImageResponse
)
async def check_homework_image(
    image: UploadFile = File(...)
):
    img_bytes = await image.read()
    data_url = image_to_data_url(image, img_bytes)

    # ======================
    # 核心 Prompt（工程稳定版）
    # ======================
    prompt = """
あなたは日本の小学生の宿題をチェックする先生です。

【最重要ルール】
- 必ず「この画像に実際に写っている内容」のみを使ってください
- 推測・一般例・想像は禁止です
- 読み取れない場合は正直に「不明」と書いてください

【教科の判断】
次の中から、画像に最も近い教科を1つ選んでください：
- 国語：ひらがな・カタカナ・漢字・文章・空欄（＿＿）
- 算数：数字・計算式・＝・□・図形
- 英語：アルファベット・英単語・英文
- 理科：実験・観察・植物・動物・天気
- 不明：机・床・白紙など学習内容がない場合のみ

※ 学習内容が写っていれば、多少あいまいでも「最も近い教科」を選んでください。
※ 「不明」は最後の手段です。

【作業内容】
1. 教科を1つ決める
2. 問題文と子どもの答えを読み取る
3. 正解かどうかを判断する

【出力ルール】
- 必ず JSON のみを返してください
- 画像内に問題が見つからない場合は problems を空配列にしてください

【出力形式】
{
  "subject": "国語 | 算数 | 英語 | 理科 | 不明",
  "detected_grade": "小1〜小6 または null",
  "problems": [
    {
      "id": 1,
      "question_text": "画像から読み取れた問題文（読めない場合は '不明'）",
      "child_answer": "画像から読み取れた子どもの答え（読めない場合は '不明'）",
      "correct": true または false,
      "score": 0.0〜1.0,
      "feedback": "画像内容に基づく短い先生コメント",
      "hint": "答えを直接言わないヒント"
    }
  ]
}

【最終確認】
- この内容は必ずこの画像に基づいていますか？
- 画像を見ずに作っていませんか？
"""

    try:
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
        parsed = safe_json_parse(raw)

        # ===== 兜底，保证结构稳定 =====
        subject = parsed.get("subject", "不明")
        problems = parsed.get("problems", [])

        if not isinstance(problems, list):
            problems = []

        return {
            "subject": subject,
            "detected_grade": parsed.get("detected_grade"),
            "problems": problems
        }

    except Exception:
        # ⚠️ 任何异常都不要 500
        return {
            "subject": "不明",
            "detected_grade": None,
            "problems": []
        }
