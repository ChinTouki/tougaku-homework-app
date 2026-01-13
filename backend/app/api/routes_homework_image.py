import os
import re
import base64
import json
from typing import List
from fractions import Fraction

from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# =========================
# 安全 JSON 解析
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
                return json.loads(text[start:end + 1])
            except Exception:
                return {}
        return {}

# =========================
# 表达式标准化
# =========================

def normalize_expression(expr: str) -> str:
    expr = expr.replace("×", "*").replace("÷", "/").replace("−", "-")

    # 带分数：3 1/2 → Fraction(7,2)
    mixed = re.match(r"(\d+)\s+(\d+)/(\d+)", expr)
    if mixed:
        whole = int(mixed.group(1))
        num = int(mixed.group(2))
        den = int(mixed.group(3))
        return f"Fraction({whole * den + num},{den})"

    # 普通分数：1/3 → Fraction(1,3)
    expr = re.sub(
        r"(\d+)\s*/\s*(\d+)",
        r"Fraction(\1,\2)",
        expr
    )

    return expr.strip()

# =========================
# 精确计算（分数）
# =========================

def eval_expression(expr: str) -> str:
    try:
        expr = normalize_expression(expr)
        result = eval(expr, {"Fraction": Fraction})

        if isinstance(result, Fraction):
            # 整数
            if result.denominator == 1:
                return str(result.numerator)

            # 带分数（小学生常用）
            whole = result.numerator // result.denominator
            rem = result.numerator % result.denominator
            if whole > 0:
                return f"{whole} {rem}/{result.denominator}"

            # 真分数
            return f"{result.numerator}/{result.denominator}"

        return str(result)
    except Exception:
        return ""

# =========================
# 错因分类
# =========================

def classify_math_error(expr: str, student: str, correct: str) -> str:
    if "/" in expr:
        return "分数の計算ミス"

    if "+" in expr or "-" in expr:
        return "繰り上がり・繰り下がり"

    if "*" in expr:
        return "九九の間違い"

    return "計算ミス"

# =========================
# 类似练习生成
# =========================

def generate_similar_exercises(expr: str, error_type: str) -> List[str]:
    if error_type == "分数の計算ミス":
        return [
            "1/2 + 1/3 = ?",
            "2 1/4 + 1/4 = ?",
            "3/5 + 2/5 = ?",
        ]

    if error_type == "九九の間違い":
        return ["6 × 4 = ?", "7 × 8 = ?", "9 × 3 = ?"]

    if error_type == "繰り上がり・繰り下がり":
        return ["18 + 7 = ?", "34 - 9 = ?", "56 + 8 = ?"]

    return ["7 + 6 = ?", "9 - 4 = ?", "5 × 3 = ?"]

# =========================
# API：算数拍照批改（分数対応）
# =========================

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    try:
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{ct};base64,{b64}"

        prompt = """
你是小学算数作业批改助手。

【必须遵守】
- 按行识别所有算式
- 提取算式（等号左边）
- 提取学生答案（等号右边）
- 支持分数、带分数、× ÷
- 不要合并算式，不要省略

【输出 JSON】
{
  "items": [
    {
      "expression": "3 1/2 + 2",
      "student_answer": "5 1/2"
    }
  ]
}
"""

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
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

        parsed = safe_parse_json(completion.choices[0].message.content)
        items = parsed.get("items", [])

        problems = []

        for it in items:
            expr = it.get("expression", "").strip()
            student = it.get("student_answer", "").strip()
            if not expr or not student:
                continue

            correct = eval_expression(expr)
            is_correct = student.replace(" ", "") == correct.replace(" ", "")

            error_type = ""
            error_message = ""
            similar_exercises = []

            if not is_correct:
                error_type = classify_math_error(expr, student, correct)
                error_message = error_type
                similar_exercises = generate_similar_exercises(expr, error_type)

            problems.append({
                "expression": expr,
                "student_answer": student,
                "correct_answer": correct,
                "is_correct": is_correct,
                "error_type": error_type,
                "error_message": error_message,
                "similar_exercises": similar_exercises,
            })

        summary = {
            "total": len(problems),
            "correct": sum(1 for p in problems if p["is_correct"]),
            "wrong": sum(1 for p in problems if not p["is_correct"]),
        }

        return {"problems": problems, "summary": summary}

    except Exception:
        return {"problems": [], "summary": {"total": 0, "correct": 0, "wrong": 0}}
