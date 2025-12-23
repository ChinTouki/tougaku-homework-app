# backend/app/api/routes_practice.py
import os
import json
from typing import List, Optional, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI

router = APIRouter()

# 注意：Render 上一定要设置 OPENAI_API_KEY
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class PracticeQuestion(BaseModel):
    id: int
    question: str
    answer: str
    explanation: str
    difficulty: Optional[Literal["やさしい", "ふつう", "むずかしい"]] = None
    skill_tags: Optional[List[str]] = None


class GeneratePracticeRequest(BaseModel):
    grade: str = Field(..., description="例: 小1, 小2, 小3, 小4, 小5, 小6")
    subject: str = Field(..., description="例: 思考力 / 算数 / 国語 など")
    num_questions: int = Field(3, ge=1, le=10)
    skill_focus: Optional[str] = Field(None, description="例: 推理パズル / 条件整理 / ロジック など")


class GeneratePracticeResponse(BaseModel):
    grade: str
    subject: str
    skill_focus: Optional[str]
    questions: List[PracticeQuestion]


def _parse_grade_num(grade: str) -> int:
    # "小4" -> 4
    digits = "".join([c for c in grade if c.isdigit()])
    return int(digits) if digits else 3


def _fallback_questions(grade_num: int, n: int) -> List[PracticeQuestion]:
    # 失敗時の固定問題（年級別に少しだけ変える）
    # ここは最低限の保険。普段は LLM が生成する。
    base = []
    if grade_num <= 2:
        base = [
            PracticeQuestion(
                id=1,
                question="3つのりんごがあります。2つたべました。のこりはいくつ？",
                answer="1つ",
                explanation="3から2をひくと1です。",
                difficulty="やさしい",
                skill_tags=["数", "ひき算"],
            ),
            PracticeQuestion(
                id=2,
                question="AくんはBくんより背が高い。CくんはAくんより背が低い。いちばん背が高いのはだれ？",
                answer="Aくん",
                explanation="AはBより高い、CはAより低いので、Aがいちばん高い。",
                difficulty="ふつう",
                skill_tags=["推理", "条件整理"],
            ),
        ]
    elif grade_num <= 4:
        base = [
            PracticeQuestion(
                id=1,
                question="赤いカードが5枚、青いカードが3枚あります。赤を2枚、青を1枚使いました。のこりは何枚？",
                answer="5枚",
                explanation="全部で8枚。使ったのは3枚。8-3=5。",
                difficulty="やさしい",
                skill_tags=["計算", "文章題"],
            ),
            PracticeQuestion(
                id=2,
                question="ポチはタロウより速い。ハナはポチより速い。いちばん速いのはだれ？",
                answer="ハナ",
                explanation="ハナ > ポチ > タロウ なので、ハナがいちばん速い。",
                difficulty="ふつう",
                skill_tags=["推理", "条件整理"],
            ),
        ]
    else:
        base = [
            PracticeQuestion(
                id=1,
                question="AはBより大きい。BはCより小さい。AとCのどちらが大きいかは決まる？",
                answer="決まらない",
                explanation="A>B と B<C だけでは A と C の大小は確定しません。",
                difficulty="ふつう",
                skill_tags=["論理", "条件不足"],
            ),
            PracticeQuestion(
                id=2,
                question="1〜9から3つ選んで和が15になる組み合わせを1つ答えてください。",
                answer="1,5,9（例）",
                explanation="1+5+9=15。ほかにも組み合わせがあります。",
                difficulty="ふつう",
                skill_tags=["探索", "数"],
            ),
        ]
    return base[: max(1, min(n, len(base)))]


def _build_prompt(grade_num: int, body: GeneratePracticeRequest) -> str:
    # 学年に合わせて難易度・表現を調整
    if grade_num <= 2:
        level_hint = "小学低学年向け。ひらがな多め。1文を短く。"
        diff_mix = "やさしい中心（たまにふつう）。"
    elif grade_num <= 4:
        level_hint = "小学中学年向け。短い文章題と簡単な条件整理。"
        diff_mix = "やさしい〜ふつう中心。"
    else:
        level_hint = "小学高学年向け。条件の組み合わせ、場合分けの入口。"
        diff_mix = "ふつう中心（たまにむずかしい）。"

    focus = body.skill_focus or "推理パズル"
    n = body.num_questions

    return f"""
あなたは日本の小学生向け「思考力ドリル」の作問者です。
学年に合わせて、{focus} に関する問題を {n} 問作ってください。

学年: 小{grade_num}
方針: {level_hint}
難易度: {diff_mix}

必須条件:
- 出力は必ず JSON のみ（説明文や挨拶は禁止）
- 各問題に question / answer / explanation を必ず含める
- explanation は「どう考えると解けるか」を手順で短く説明する
- 日本語で出題（低学年はひらがな多め）
- 似た問題になりすぎないよう、各問はテーマや設定を変える

出力JSONフォーマット:
{{
  "questions": [
    {{
      "id": 1,
      "question": "問題文",
      "answer": "答え",
      "explanation": "解説",
      "difficulty": "やさしい",
      "skill_tags": ["推理","条件整理"]
    }}
  ]
}}
""".strip()


def _llm_generate(body: GeneratePracticeRequest) -> List[PracticeQuestion]:
    grade_num = _parse_grade_num(body.grade)
    prompt = _build_prompt(grade_num, body)

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.6,
        messages=[
            {"role": "system", "content": "JSONだけを返してください。"},
            {"role": "user", "content": prompt},
        ],
    )

    raw = completion.choices[0].message.content

    # JSON パース
    parsed = json.loads(raw)
    qs = parsed.get("questions", [])
    if not isinstance(qs, list) or len(qs) == 0:
        raise ValueError("questions 配列がありません")

    questions: List[PracticeQuestion] = []
    for i, q in enumerate(qs, start=1):
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

    # 题数限制：最多取 num_questions
    return questions[: body.num_questions]


@router.post("/generate_practice", response_model=GeneratePracticeResponse)
async def generate_practice(body: GeneratePracticeRequest):
    grade_num = _parse_grade_num(body.grade)

    # 开关：Render 环境变量 USE_LLM_PRACTICE=1 才启用 LLM（便于灰度/回滚）
    use_llm = os.getenv("USE_LLM_PRACTICE", "0") == "1"

    if not use_llm:
        return GeneratePracticeResponse(
            grade=body.grade,
            subject=body.subject,
            skill_focus=body.skill_focus,
            questions=_fallback_questions(grade_num, body.num_questions),
        )

    try:
        questions = _llm_generate(body)
        # 防御：题干为空就 fallback
        if any((not q.question) for q in questions):
            raise ValueError("空の question が含まれています")
        return GeneratePracticeResponse(
            grade=body.grade,
            subject=body.subject,
            skill_focus=body.skill_focus,
            questions=questions,
        )
    except Exception:
        # 任何异常都回退固定题，保证前端永不白屏
        return GeneratePracticeResponse(
            grade=body.grade,
            subject=body.subject,
            skill_focus=body.skill_focus,
            questions=_fallback_questions(grade_num, body.num_questions),
        )
