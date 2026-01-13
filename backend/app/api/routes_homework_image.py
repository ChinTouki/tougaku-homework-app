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
# 分数解析（关键）
# =========================

def parse_fraction(s: str) -> Fraction | None:
    s = s.strip()
    try:
        # 带分数：3 1/2
        m = re.match(r"(\d+)\s+(\d+)/(\d+)", s)
        if m:
            return Fraction(int(m.group(1)) * int(m.group(3)) + int(m.group(2)),
                            int(m.group(3)))

        # 普通分数：1/3
        m = re.match(r"(\d+)/(\d+)", s)
        if m:
            return Fraction(int(m.group(1)), int(m.group(2)))

        # 整数
        return Fraction(int(s), 1)
    except Exception:
        return None

# =========================
# 计算表达式（支持分数）
# =========================

def eval_expression(expr: str) -> Fraction | None:
    try:
        expr = expr.replace("×", "*").replace("÷", "/").replace("−", "-")

        # 把 1/2 → Fraction(1,2)
        expr = re.sub(
            r"(\d+)\s*/\s*(\d+)",
            r"Fraction(\1,\2)",
            expr
        )

        return eval(expr, {"Fraction": Fraction})
    except Exception:
        return None

# =========================
# 错因分类
# =========================

def classify_math_error(expr: str) -> str:
    if "/" in expr:
        return "分数の計算ミス"
    if "*" in expr:
        return "九九の間違い"
    if "+" in expr or "-" in expr:
        return "繰り上がり・繰り下がり"
    return "計算ミス"

# =========================
# API：算数拍照批改（最终版）
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

请逐行识别图片中的所有算式：
- 提取等号左边的算式
- 提取等号右边学生的答案
- 支持分数、带分数、× ÷

只返回 JSON：
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
            student_raw = it.get("student_answer", "").strip()

            if not expr or not student_raw:
                continue

            correct_val = eval_expression(expr)
            student_val = parse_fraction(student_raw)

            if correct_val is None or student_val is None:
                continue

            is_correct = correct_val == student_val

            problems.append({
                "expression": expr,
                "student_answer": student_raw,
                "correct_answer": str(correct_val),
                "is_correct": is_correct,
                "error_type": "" if is_correct else classify_math_error(expr),
            })

        summary = {
            "total": len(problems),
            "correct": sum(1 for p in problems if p["is_correct"]),
            "wrong": sum(1 for p in problems if not p["is_correct"]),
        }

        return {"problems": problems, "summary": summary}

    except Exception:
        return {"problems": [], "summary": {"total": 0, "correct": 0, "wrong": 0}}
