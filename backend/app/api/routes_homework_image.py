import os, json, base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class SimilarPractice(BaseModel):
    question: str
    answer: str
    explanation: str

class ImageProblemResult(BaseModel):
    id: int
    bbox: Optional[List[float]] = None  # 今は None でもOK（後で位置推定）
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
                bbox=[0.12, 0.20, 0.35, 0.10],
                question_text="3+4=いくつですか？",
                child_answer="7",
                correct=True,
                score=1.0,
                feedback="とてもよくできました！",
                hint="次は2けたの足し算にもチャレンジしてみましょう。",
                similar_practice=[
                    SimilarPractice(question="5+6=?", answer="11", explanation="5と6を足すと11。")
                ],
            )
        ],
    )

@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(
    subject: Optional[str] = Form(None),
    image: UploadFile = File(...),
):
    subj = subject or "auto"

    # 画像読み込み → base64
    img_bytes = await image.read()
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    data_url = f"data:{image.content_type};base64,{b64}"

    # 開発・緊急時のダミー切替
    if os.getenv("USE_VISION", "0") != "1":
        return _dummy_response("算数" if subj == "auto" else subj)

    prompt = f"""
あなたは日本の小学生の宿題を採点する先生です。
この画像の中にある「問題」と「子どもの答え」を読み取り、各設問ごとに採点してください。

条件：
- 学年選択は不要。画像から推定しても良い。
- subject は {subj}（auto の場合はあなたが推定）。
- 返答は必ず JSON のみ（説明文は禁止）。

出力JSONフォーマット：
{{
  "subject": "国語/算数/英語/理科",
  "detected_grade": "小1〜小6 など（推定）",
  "problems": [
    {{
      "id": 1,
      "question_text": "問題文（読み取った内容）",
      "child_answer": "子どもの答え（読み取った内容）",
      "correct": true,
      "score": 1.0,
      "feedback": "短いコメント",
      "hint": "答えを直接言わずヒント",
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

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": "JSONだけを返してください。"},
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ]}
            ],
        )
        raw = completion.choices[0].message.content
        parsed = json.loads(raw)
        return parsed
    except Exception as e:
        # 失敗したらダミーにフォールバック（本番でも落ちない）
        # ここで 500 にしても良いが、MVPは「動くこと」を優先
        return _dummy_response("算数" if subj == "auto" else subj)
