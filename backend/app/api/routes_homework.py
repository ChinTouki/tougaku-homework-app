from typing import Literal, Optional, List
import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI

from app.core.config import settings  # 先保留，后面需要的话可以用 settings 里的配置

# OpenAI クライアント（環境変数から API キー取得）
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    # 「小4」→ "4" みたいに数字だけ抜き出す（なければ 3 年生想定）
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


def call_llm_for_homework(prompt: str) -> str:
    """LLM を呼び出して、生の JSON 文字列（のはず）を返す"""
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "あなたは日本の小学生向けの先生です。"
                    "出力は必ず JSON 1 つだけにしてください。"
                    "説明文や感想など、JSON 以外のテキストは書かないでください。"
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
    )
    # 新 SDK: content は基本 string で返ってくる想定
    return completion.choices[0].message.content


@router.post("/check_homework", response_model=CheckHomeworkResponse)
async def check_homework(body: CheckHomeworkRequest):
    prompt = build_homework_prompt(body)
    raw = call_llm_for_homework(prompt)

    # raw は LLM が返した「JSON 文字列」なので、まずパースする
    try:
        if not isinstance(raw, str):
            # 念のため、list などで返ってきたときも安全側に寄せておく
            raw_str = json.dumps(raw, ensure_ascii=False)
        else:
            raw_str = raw

        parsed = json.loads(raw_str)
    except json.JSONDecodeError:
        # LLM が変なフォーマットを返したとき
        raise HTTPException(
            status_code=500,
            detail="LLMからの応答をJSONとして解析できませんでした。",
        )

    # parsed を Pydantic モデルにマッピング
    try:
        result = CheckHomeworkResult(
            correct=bool(parsed.get("correct", False)),
            score=float(parsed.get("score", 0.0)),
            correct_answer_example=str(parsed.get("correct_answer_example", "")).strip(),
            feedback_message=str(parsed.get("feedback_message", "")).strip(),
            hint=str(parsed.get("hint", "")).strip(),
            difficulty=parsed.get("difficulty"),
            topic_tags=parsed.get("topic_tags"),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLMからの応答を評価用データに変換できませんでした: {e}",
        )

    return CheckHomeworkResponse(
        grade=body.grade,
        subject=body.subject,
        result=result,
    )
