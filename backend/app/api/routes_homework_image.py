import os
import re
import base64
import json
from typing import List

from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# =========================
# 工具：安全 JSON 解析
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
                return json.loads(text[start:end+1])
            except Exception:
                return {}
        return {}

# =========================
# 工具：安全计算算式
# =========================

def eval_expression(expr: str) -> str:
    try:
        if not re.match(r"^[0-9+\-*/(). ]+$", expr):
            return ""
        result = eval(expr, {"__builtins__": {}})
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        return str(result)
    except Exception:
        return ""

# =========================
# 工具：错因分类
# =========================

def classify_math_error(expr: str, student: str, correct: str) -> str:
    try:
        a = int(student)
        b = int(correct)
    except Exception:
        return "計算ミス"

    if "+" in expr or "-" in expr:
        if abs(a - b) == 10:
            return "繰り上がり・繰り下がり"

    if "*" in expr or "×" in expr:
        return "九九の間違い"

    return "計算ミス"

# =========================
# API：算数拍照批改
# =========================

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    try:
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{ct};base64,{b64}"

        prompt = """
你是一个小学算数作业批改助手。

请只做以下事情：
1. 从图片中找出所有算数算式（可能有多行）
2. 提取算式（不含等号右边）
3. 提取学生写的答案（等号右边）

只处理加减乘除。
不解释，不扩展，不处理国语或英语。

返回 JSON：
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

        parsed = safe_parse_json(completion.choices[0].message.content)
        items = parsed.get("items", [])

        problems = []
        for it in items:
            expr = it.get("expression", "").strip()
            student = it.get("student_answer", "").strip()
            correct = eval_expression(expr)

            if not expr or not student or not correct:
                continue

            is_correct = student == correct
            error_type = ""
            if not is_correct:
                error_type = classify_math_error(expr, student, correct)

            problems.append({
                "expression": expr,
                "student_answer": student,
                "correct_answer": correct,
                "is_correct": is_correct,
                "error_type": error_type,
            })

        summary = {
            "total": len(problems),
            "correct": sum(1 for p in problems if p["is_correct"]),
            "wrong": sum(1 for p in problems if not p["is_correct"]),
        }

        return {
            "problems": problems,
            "summary": summary,
        }

    except Exception:
        return {
            "problems": [],
            "summary": {"total": 0, "correct": 0, "wrong": 0},
        }
