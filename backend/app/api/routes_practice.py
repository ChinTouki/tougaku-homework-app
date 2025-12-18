# backend/app/api/routes_practice.py
from typing import List, Optional
import os
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI

# 和 homework 用同一个 OPENAI_API_KEY
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

router = APIRouter()


class GeneratePracticeRequest(BaseModel):
    grade: str = Field(..., description="例: 小1, 小2, 小3 ...")
    subject: str = Field(..., description="例: 思考力, 算数 など")
    num_questions: int = Field(3, ge=1, le=10, description="出題数（1〜10）")
    skill_focus: Optional[str] = Field(
        None, description="例: 推理パズル, 図形, 文章題 など"
    )


class PracticeQuestion(BaseModel):
    id: int
    question: str
    answer: str
    explanation: str
    difficulty: Optional[str] = None
    skill_tags: Optional[List[str]] = None  # ["推理", "条件整理"] など


class GeneratePracticeResponse(BaseModel):
    grade: str
    subject: str
    skill_focus: Optional[str]
    questions: List[PracticeQuestion]


def build_practice_prompt(body: GeneratePracticeRequest) -> str:
    numeric_grade = "".join([c for c in body.grade if c.isdigit()]) or "3"

    focus = body.skill_focus or "思考力パズル"
    n = body.num_questions

    prompt = f"""
あなたは日本の小学生向けの思考力ドリル作成のプロの先生です。
小学{numeric_grade}年生レベルのお子さま向けに、「{focus}」タイプの問題を作ってください。

### 前提
- 学年: {body.grade}
- 科目: {body.subject}
- スキルの焦点: {focus}
- 出題数: {n}問

### 問題の条件
- すべて日本語で書くこと。
- 小学生でも楽しめる、ゲーム感のある文章や設定にしてよい。
- ただしルールは分かりやすく、1問あたりの文章は長すぎないようにする。
- 解説は、「どう考えると解けるか」をステップを追って説明すること。

### 出力フォーマット（重要）
次のような JSON だけを出力してください。余計な文章は書かないでください。

{{
  "questions": [
    {{
      "id": 1,
      "question": "ここに問題文",
      "answer": "ここに答え",
      "explanation": "ここに、どう考えると解けるかの解説",
      "difficulty": "ふつう",
      "skill_tags": ["推理", "条件整理"]
    }},
    {{
      "id": 2,
      "question": "ここに問題文",
      "answer": "ここに答え",
      "explanation": "ここに解説",
      "difficulty": "やさしい",
      "skill_tags": ["図形", "イメージ力"]
    }}
  ]
}}
    """.strip()

    return prompt


def call_llm_for_practice(prompt: str) -> str:
    """LLM を呼び出して、生の JSON 文字列を返す"""
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "あなたは日本の小学生向けドリル作成の先生です。"
                    "出力は必ず JSON 1 つだけにしてください。"
                    "説明文や感想など、JSON 以外のテキストは書かないでください。"
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.4,
    )
    return completion.choices[0].message.content


@router.post("/generate_practice", response_model=GeneratePracticeResponse)
async def generate_practice(body: GeneratePracticeRequest):
    prompt = build_practice_prompt(body)
    raw = call_llm_for_practice(prompt)

    try:
        raw_str = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)
        parsed = json.loads(raw_str)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="LLMからの応答をJSONとして解析できませんでした。（generate_practice）",
        )

    questions_data = parsed.get("questions", [])
    if not isinstance(questions_data, list):
        raise HTTPException(
            status_code=500,
            detail="LLMからの応答に questions 配列が含まれていません。",
        )

    questions: List[PracticeQuestion] = []
    for i, q in enumerate(questions_data, start=1):
        try:
            questions.append(
                PracticeQuestion(
                    id=int(q.get("id", i)),
                    question=str(q.get("question", "")).strip(),
                    answer=str(q.get("answer", "")).strip(),
                    explanation=str(q.get("explanation", "")).strip(),
                    difficulty=q.get("difficulty"),
                    skill_tags=q.get("skill_tags"),
                )
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"LLMからの応答を問題データに変換できませんでした: {e}",
            )

    return GeneratePracticeResponse(
        grade=body.grade,
        subject=body.subject,
        skill_focus=body.skill_focus,
        questions=questions,
    )
