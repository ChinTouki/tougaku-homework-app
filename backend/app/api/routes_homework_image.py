# backend/app/api/routes_homework_image.py
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel, Field

router = APIRouter()


class SimilarPractice(BaseModel):
    question: str
    answer: str
    explanation: str


class ImageProblemResult(BaseModel):
    id: int
    # [x, y, width, height] すべて 0〜1 の正規化座標（画像に対する割合）
    bbox: List[float] = Field(
        ...,
        min_items=4,
        max_items=4,
        description="問題エリアの位置 [x, y, width, height] (0〜1)",
    )
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


@router.post(
    "/check_homework_image",
    response_model=CheckHomeworkImageResponse,
    summary="宿題カメラでチェック（MVP：ダミーデータ版）",
)
async def check_homework_image(
    subject: Optional[str] = Form(
        None,
        description="科目: 国語 / 算数 / 英語 / 理科 / auto （未指定なら auto）",
    ),
    image: UploadFile = File(..., description="宿題の写真"),
):
    """
    宿題の写真をアップロードして、問題ごとの正誤とフィードバックを返す API。

    ★ 今はまだ OCR や Vision モデルはつながず、
      ダミーの結果を返す MVP 実装です。
    """

    # TODO: ここで image.read() して OpenAI Vision に投げる実装に差し替え予定
    _ = await image.read()  # いまは実際には使わない（型・流れだけ合わせる）

    subj = subject or "auto"

    # ダミーの結果（あなたが /docs で見た JSON に近い形）
    dummy = CheckHomeworkImageResponse(
        subject="算数" if subj in (None, "", "auto") else subj,
        detected_grade="小4",
        problems=[
            ImageProblemResult(
                id=1,
                bbox=[0.12, 0.20, 0.35, 0.10],
                question_text="3+4=いくつですか？",
                child_answer="7",
                correct=True,
                score=1.0,
                feedback="とてもよくできました！このレベルはばっちりです。",
                hint="次は2けたの足し算にもチャレンジしてみましょう。",
                similar_practice=[
                    SimilarPractice(
                        question="5+6=？",
                        answer="11",
                        explanation="一のくらい 5 と 6 をたすと 11 になります。",
                    )
                ],
            ),
            ImageProblemResult(
                id=2,
                bbox=[0.15, 0.40, 0.40, 0.10],
                question_text="12-5=？",
                child_answer="4",
                correct=False,
                score=0.0,
                feedback="引き算のときに、10をこえるところでつまずいているようです。",
                hint="12 を 10 と 2 に分けて考えると分かりやすくなります。",
                similar_practice=[
                    SimilarPractice(
                        question="13-5=？",
                        answer="8",
                        explanation="10-5=5 と、残りの 3 をたして 8 になります。",
                    )
                ],
            ),
        ],
    )

    return dummy
