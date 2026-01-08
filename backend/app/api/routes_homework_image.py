import os, json, base64
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
    question_text: str
    child_answer: str
    correct: bool
    score: float = Field(..., ge=0.0, le=1.0)
    feedback: str
    hint: str
    # 注意：这里先不生成练习题（延迟到用户点的时候）
    similar_practice: List[SimilarPractice] = []

class CheckHomeworkImageResponse(BaseModel):
    subject: str
    detected_grade: Optional[str] = None
    problems: List[ImageProblemResult]

def _img_to_data_url(image: UploadFile, img_bytes: bytes) -> str:
    ct = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:{ct};base64,{b64}"

@router.post("/check_homework_image", response_model=CheckHomeworkImageResponse)
async def check_homework_image(
    subject: Optional[str] = Form(None),
    image: UploadFile = File(...),
):
    subj = subject or "auto"

    img_bytes = await image.read()
    data_url = _img_to_data_url(image, img_bytes)

    # 单次 Vision Prompt（抽题 + 初步判定）
    prompt = f"""
あなたは日本の小学生の宿題をチェックする先生です。

【最重要ルール】
- 必ず「この画像に実際に写っている内容」のみを使って判断してください。
- 画像から読み取れない内容は、絶対に推測・補完・想像してはいけません。
- 読み取れない場合は、正直に「不明」と書いてください。

【やってはいけないこと】
- 一般的な例題を使う
- 前回と同じ問題文を使う
- 画像に書かれていない内容を作る

【作業内容】
1. 画像内の印刷された問題文を読み取る
2. 画像内の子どもの手書きの答えを読み取る
3. 各問題について、正解かどうかを判断する

【優先順位】
- 公文式・学校配布プリントなどの印刷宿題を最優先
- ノートの自由手書きは補助的に扱う

【注意】
- 学年は推定してもよいが、確信がなければ null
- subject は {subj}（auto の場合は内容から判断）
- 画像内に問題が見つからない場合は problems を空配列にする

【出力形式】
以下の JSON 形式のみを返してください。説明文は禁止です。

{{
  "subject": "国語/算数/英語/理科",
  "detected_grade": "小1〜小6 または null",
  "problems": [
    {{
      "id": 1,
      "question_text": "画像から読み取れた問題文（読めない場合は '不明'）",
      "child_answer": "画像から読み取れた子どもの答え（読めない場合は '不明'）",
      "correct": true または false,
      "score": 0.0〜1.0,
      "feedback": "画像内容に基づく短い先生コメント",
      "hint": "答えを直接言わないヒント"
    }}
  ]
}}

【最後の確認】
- この JSON の内容は、必ずこの画像に基づいていますか？
- 画像を見ずに答えていませんか？
"""


    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.2,
        messages=[
            {"role": "system", "content": "JSONだけを返してください。"},
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
