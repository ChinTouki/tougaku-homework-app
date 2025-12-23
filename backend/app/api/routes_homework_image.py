import os
import json
import base64
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel, Field
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class SimilarPractice(BaseModel):
    question: str
    answer: str
    explanation: str


class ImageProblemResult(BaseModel):
    id: int
    # bbox は手書きだと精度が不安定なので MVP は Optional にする（今は overlay 無しでもOK）
    bbox: Optional[List[float]] = None  # [x, y, w, h] (0〜1)
    question_text: str
    child_answer: str
    correct: bool
    score: float = Field(..., ge=0.0, le=1.0)
    feedback: str
    hint: str
    similar_practice: List[SimilarPractice] = []


class CheckHomeworkImageResponse(BaseModel):
    subject: str
    detected_grade: Optional[str] = None
    problems: List[ImageProblemResult]


def _dummy_response(subject: str) -> CheckHomeworkImageResponse:
    return CheckHomeworkImageResponse(
        subject=subject or "算数",
        detected_grade="小4",
        problems=[
            ImageProblemResult(
                id=1,
                bbox=None,
                question_text="（ダミー）12-5=？",
                child_answer="4",
                correct=False,
                score=0.0,
                feedback="繰り下がりでつまずいているようです。",
                hint="12を10と2に分けて考えると分かりやすいよ。",
                similar_practice=[
                    SimilarPractice(
                        question="13-5=？",
                        answer="8",
                        explanation="10-5=5、残りの3を足して8。",
                    )
                ],
            )
        ],
    )


def _img_to_data_url(image: UploadFile, img_bytes: bytes) -> str:
    ct = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:{ct};base64,{b64}"


def _extract_structured_items(data_url: str, subject: str) -> dict:
    """
    手書き対応：まず画像から「題番号・問題文・子どもの答え」を抽出する段階。
    ここは正誤判定しない。抽出に集中させる。
    """
    prompt = f"""
あなたは日本の小学生の宿題（手書きノート）を読み取る専門家です。
画像から「題番号」「問題文」「子どもの答え」をできるだけ正確に抽出してください。

制約：
- 学年は不要（推定したければ detected_grade に入れてよい）
- subject は {subject}（auto の場合は推定）
- 1ページに複数の設問がある想定
- 文字が読めない場合は推測せず、「不明」と書いてよい
- 余計な文章は禁止。JSON のみ。

出力フォーマット（JSONのみ）：
{{
  "subject": "国語/算数/英語/理科",
  "detected_grade": "小1〜小6（推定、不要なら null）",
  "items": [
    {{
      "id": 1,
      "question_text": "読み取った問題文（不明なら短く不明と）",
      "child_answer": "読み取った子どもの答え（不明なら不明）"
    }}
  ]
}}
"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.0,
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
    return json.loads(raw)


def _grade_and_feedback(items_json: dict) -> dict:
    """
    抽出した items をもとに、正誤判定＋ヒント＋似た問題を生成する段階。
    """
    prompt = f"""
あなたは日本の小学生向けの先生です。
次の items は、手書きノートから抽出した「問題文」と「子どもの答え」です。
各設問について採点し、ヒントと似た練習問題を作ってください。

items:
{json.dumps(items_json, ensure_ascii=False)}

出力フォーマット（JSONのみ）：
{{
  "subject": "国語/算数/英語/理科",
  "detected_grade": "小1〜小6（推定）",
  "problems": [
    {{
      "id": 1,
      "question_text": "...",
      "child_answer": "...",
      "correct": true,
      "score": 1.0,
      "feedback": "短いコメント",
      "hint": "答えを直接言わないヒント",
      "similar_practice": [
        {{
          "question": "似た問題",
          "answer": "答え",
          "explanation": "解説"
        }}
      ]
    }}
  ]
}}
"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.2,
        messages=[
            {"role": "system", "content": "必ずJSONだけを返してください。"},
            {"role": "user", "content": prompt},
        ],
    )
    raw = completion.choices[0].message.content
    return json.loads(raw)


@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(
    subject: Optional[str] = Form(None),
    image: UploadFile = File(...),
):
    subj = subject or "auto"

    # 開発・緊急時の切替（ENVで制御）
    if os.getenv("USE_VISION", "0") != "1":
        return _dummy_response("算数" if subj == "auto" else subj)

    img_bytes = await image.read()
    data_url = _img_to_data_url(image, img_bytes)

    try:
        # 1) 抽出
        extracted = _extract_structured_items(data_url, subj)

        # 2) 採点・フィードバック
        graded = _grade_and_feedback(extracted)

        # bbox は手書きだと難しいので None を入れる（あとで改善）
        for p in graded.get("problems", []):
            p["bbox"] = None

        return graded
    except Exception:
        # 失敗したらダミーにフォールバック（落ちないこと優先）
        return _dummy_response("算数" if subj == "auto" else subj)
