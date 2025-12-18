from typing import Optional, Literal, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class GeneratePracticeRequest(BaseModel):
    grade: str          # "小4"
    subject: str        # "思考力" / "算数" / ...
    num_questions: int  # 3
    skill_focus: Optional[str] = None  # "推理パズル" など


class PracticeQuestion(BaseModel):
    id: str
    text: str
    choices: Optional[List[str]] = None
    answer: Optional[str] = None
    explanation: Optional[str] = None


class GeneratePracticeResponse(BaseModel):
    grade: str
    subject: str
    skill_focus: Optional[str]
    questions: List[PracticeQuestion]


@router.post("/generate_practice", response_model=GeneratePracticeResponse)
async def generate_practice(body: GeneratePracticeRequest):
    """
    今は仮実装として静的な問題を返す。
    あとで LLM を呼び出して動的生成に変えてOK。
    """
    if body.subject == "思考力" and body.skill_focus == "推理パズル":
        # 简单示例：固定几道推理题
        base_questions = [
            PracticeQuestion(
                id="riddle1",
                text="3人の子ども（Aくん、Bくん、Cくん）がなわとびをしました。Aくんは10回、BくんはAくんより3回多く、CくんはBくんより2回少なくとびました。Cくんは何回とんだでしょう？",
                answer="11回",
                explanation="A=10回, B=10+3=13回, C=13-2=11回。",
            ),
            PracticeQuestion(
                id="riddle2",
                text="1〜9の数字カードがあります。3枚えらんでたして15になる組み合わせはいくつあるでしょう？（順番は関係ありません）",
                answer="4通り",
                explanation="(1,5,9), (1,6,8), (2,4,9), (2,5,8) など。",
            ),
        ]
    else:
        # 其他科目先返回占位
        base_questions = [
            PracticeQuestion(
                id="q1",
                text=f"{body.grade}の{body.subject}の練習問題（ダミー）です。skill_focus={body.skill_focus}",
                answer=None,
                explanation="あとでAI生成に差し替えます。",
            )
        ]

    # 按 num_questions 截断或重复；这里简单截断
    questions = base_questions[: body.num_questions]

    return GeneratePracticeResponse(
        grade=body.grade,
        subject=body.subject,
        skill_focus=body.skill_focus,
        questions=questions,
    )

