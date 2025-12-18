from typing import Literal, Optional, List
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

from app.core.config import settings

router = APIRouter()


class CheckHomeworkRequest(BaseModel):
    grade: str = Field(..., description="例: 小1, 小2, 小3 ...")
    subject: Literal["国語", "算数", "英語", "思考力"] = Field(..., description="教科")
    question_text: str = Field(..., description="宿題の問題文、または要約")
    child_answer: str = Field(..., description="お子さまの答え（そのまま入力）")


class CheckHomeworkResult(BaseModel):
    correct: bool
    score: float = Field(..., ge=0.0, le=1.0)
    correct_answer_example: str
    feedback_message: str
    hint: str
    difficulty: Optional[Literal["やさしい", "ふつう", "むずかしい"]] = None
    topic_tags: Optional[List[str]] = None  # 例: ["かけ算", "文章題"]


class CheckHomeworkResponse(BaseModel):
    grade: str
    subject: str
    result: CheckHomeworkResult


def build_homework_prompt(body: CheckHomeworkRequest) -> str:
    numeric_grade = "".join([c for c in body.grade if c.isdigit()]) or "3"

    subject_desc_map = {
        "国語": "日本の小学校の国語。読み取りや言葉の使い方など。",
        "算数": "日本の小学校の算数。計算や文章題など。",
        "英語": "日本の小学校の英語。かんたんな単語や表現など。",
        "思考力": "小学生向けの思考力・パズル・論理クイズ。",
    }
    subject_desc = subject_desc_map[body.subject]

    prompt = f"""
あなたは日本の小学生向けの先生です。
小学{numeric_grade}年生レベルの「{body.subject}」の宿題をチェックします。

### 前提
- 学年: {body.grade}
- 教科: {body.subject}
- 教科の説明: {subject_desc}

### 宿題の問題
{body.question_text}

### お子さまの答え
{body.child_answer}

### あなたの役割
1. お子さまの答えが「正解かどうか」を判断してください。
2. 正解に近いが一部まちがいがある場合は、「部分点」としてスコアをつけてください。
3. 「どこでつまずいているか」をやさしい日本語で説明してください。
4. 「次にどう考えればいいか」のヒントを、答えを直接言わずに書いてください。
5. 教科書レベルでよいので「模範解答の一例」を示してください。

### 評価のルール
- score は 0.0〜1.0 のあいだで、0.0=完全に違う, 1.0=ほぼ完璧。
- correct は、おおむね合っていれば true、重要な部分が間違っていれば false。
- difficulty は「やさしい / ふつう / むずかしい」のいずれか。
- topic_tags には 2〜4 個のキーワードを日本語で入れてください。

### 出力フォーマット（重要）
次のような JSON だけを出力してください。余計な文章は書かないでください。

{{
  "correct": true,
  "score": 0.95,
  "correct_answer_example": "ここに模範解答の例",
  "feedback_message": "ここに、どこがよかったか・どこがつまずいたかの説明",
  "hint": "ここに、次にどう考えればいいかのヒント",
  "difficulty": "ふつう",
  "topic_tags": ["かけ算", "文章題"]
}}
    """.strip()

    return prompt


def call_llm_for_homework(prompt: str):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "你是一个小学生作业辅导老师，返回 JSON 格式..."
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
    )
    # 新版字段路径也变了
    return completion.choices[0].message.content


@router.post("/check_homework", response_model=CheckHomeworkResponse)
async def check_homework(body: CheckHomeworkRequest):
    prompt = build_homework_prompt(body)
    raw = call_llm_for_homework(prompt)

    result = CheckHomeworkResult(
        correct=bool(raw.get("correct", False)),
        score=float(raw.get("score", 0.0)),
        correct_answer_example=raw.get("correct_answer_example", "").strip(),
        feedback_message=raw.get("feedback_message", "").strip(),
        hint=raw.get("hint", "").strip(),
        difficulty=raw.get("difficulty"),
        topic_tags=raw.get("topic_tags"),
    )

    return CheckHomeworkResponse(
        grade=body.grade,
        subject=body.subject,
        result=result,
    )
