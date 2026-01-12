import os
import re
import base64
import json
from typing import List

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# =========================
# Response Models（算数専用）
# =========================

class MathProblemResult(BaseModel):
    expression: str            # 例: "3 + 5"
    student_answer: str        # 例: "9"
    correct_answer: str        # 例: "8"
    is_correct: bool           # True / False


class MathCheckResponse(BaseModel):
    problems: List[MathProblemResult]
    summary: dict


# =========================
# 工具：安全 JSON 解析（永不 500）
# =========================

def safe_parse_json(text: str) -> dict:
    if not text:
        return {}

    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                return {}
        return {}


# =========================
# 工具：本地计算（算数规则）
# =========================

def eval_expression(expr: str) -> str:
    """
    安全计算算式，只支持 + - * /
    """
    try:
        # 只允许数字和运算符
        if not re.match(r"^[0-9+\-*/(). ]+$", expr):
            return ""

        result = eval(expr, {"__builtins__": {}})
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        return str(result)
    except Exception:
        return ""


# =========================
# API：算数拍照批改
# =========================

@router.post(
    "/check_homework_image",
    response_model=MathCheckResponse
)
async def check_homework_image(image: UploadFile = File(...)):
    """
    算数専用：
    - 从图片中抽取「算式 + 学生答案」
    - 本地计算正确答案
    - 判对 / 错
    """
    try:
        # 读取图片
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{ct};base64,{b64}"

        # ===== Prompt（算数特化，弱推断，稳定）=====
        prompt = """
你是一个小学算数作业批改助手。

请只做以下事情：
1. 从图片中找出「算式」和「学生写的答案」
2. 只处理算数（加减乘除）
3. 不要解释，不要扩展，不要处理国语或英语

请尽量按以下形式提取：
- 算式（不包含等号后的答案）
- 学生答案（等号右边）

如果看不清，可以尽量推测，但不要编造不存在的算式。

只返回 JSON，格式如下：
{
  "items": [
    {
      "expression": "3 + 5",
      "student_answer": "9"
    }
  ]
}
"""

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.3,
            messages=[
                {"role": "system", "content": "只返回JSON"},
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
        parsed = safe_parse_json(raw)

        items = parsed.get("items", [])
        results: List[MathProblemResult] = []

        for it in items:
            expr = it.get("expression", "").strip()
            student_ans = it.get("student_answer", "").strip()

            correct_ans = eval_expression(expr)
            is_correct = (
                correct_ans != "" and student_ans != "" and student_ans == correct_ans
            )

            if expr and student_ans:
                results.append(
                    MathProblemResult(
                        expression=expr,
                        student_answer=student_ans,
                        correct_answer=correct_ans,
                        is_correct=is_correct,
                    )
                )

        summary = {
            "total": len(results),
            "correct": sum(1 for r in results if r.is_correct),
            "wrong": sum(1 for r in results if not r.is_correct),
        }

        return {
            "problems": results,
            "summary": summary,
        }

    except Exception:
        # 永远不 500
        return {
            "problems": [],
            "summary": {
                "total": 0,
                "correct": 0,
                "wrong": 0,
            },
        }
