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
あなたは日本の小学生の宿題（写真）を読み取る専門家です。

この作業は、主に【印刷された問題 + 子どもの手書きの答え】で構成されています
（例：公文式、学校配布のプリント）。
一部、【ノートに自由に書かれた手書き】が含まれる場合もあります。

次の優先順位で内容を解析してください。

【優先順位 1：印刷された宿題（B1）】
- 問題番号を探してください（例：①、1.、(1)、No.1 など）
- 問題文は主に印刷文字です
- 子どもの答えは次の場所に書かれていることが多いです：
  - 横線の上
  - 四角い枠の中
  - 問題文の近くの空白
- 「印刷された問題文」と「子どもの手書きの答え」を必ず分けてください

【優先順位 2：自由な手書き（B2・補助的）】
- 明確な問題番号や印刷構造が見当たらない場合
- 1行（または1まとまり）を1問として解析してください
- 不確実な場合は無理に判断せず、簡潔に処理してください

ルール：
- 読み取れない文字は推測しないでください。「不明」と記載してください
- 正解・不正解の判断は行いません（この段階では抽出のみ）
- 学年は推定してもよいですが、不明な場合は null で構いません
- subject は {subject} です（auto の場合は内容から判断してください）
- 必ず JSON 形式のみを出力し、説明文やコメントは一切書かないでください

出力形式（JSON）：
{{
  "subject": "国語/算数/英語/理科",
  "detected_grade": "小1〜小6（推定。不明な場合は null）",
  "items": [
    {{
      "id": 1,
      "question_text": "読み取った問題文（印刷または手書き。不明な場合は簡潔に『不明』）",
      "child_answer": "読み取った子どもの答え（不明な場合は『不明』）"
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
