import os
import re
import base64
import json
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# =========================
# 安全 JSON 解析（永不 500）
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
# 算式安全计算
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
# 错因分类（A3）
# =========================

def classify_math_error(expr: str, student: str, correct: str) -> str:
    try:
        a = int(student)
        b = int(correct)
    except Exception:
        return "計算ミス"

    # 加减的进位/借位
    if "+" in expr or "-" in expr:
        if abs(a - b) == 10:
            return "繰り上がり・繰り下がり"

    # 乘法表
    if "*" in expr or "×" in expr:
        return "九九の間違い"

    return "計算ミス"

# =========================
# 年级友好错因提示（A7）
# =========================

def format_error_message(error_type: str, grade: Optional[str]) -> str:
    if not grade:
        return error_type

    if grade in ["小1", "小2"]:
        return "ゆっくり計算してみよう"

    return error_type

# =========================
# 生成类似练习题（A6）
# =========================

def generate_similar_exercises(expr: str, error_type: str) -> List[str]:
    exercises: List[str] = []

    try:
        if error_type == "九九の間違い":
            base = int(expr.split("*")[0])
            exercises = [
                f"{base} * 2 = ?",
                f"{base} * 3 = ?",
                f"{base} * 4 = ?",
            ]

        elif error_type == "繰り上がり・繰り下がり":
            exercises = [
                "18 + 7 = ?",
                "24 - 9 = ?",
                "36 + 8 = ?",
            ]

        else:
            exercises = [
                "7 + 6 = ?",
                "9 - 4 = ?",
                "5 * 3 = ?",
            ]
    except Exception:
        exercises = ["3 + 5 = ?", "8 - 2 = ?", "4 * 6 = ?"]

    return exercises

# =========================
# API：算数拍照批改（A1+A5+A6+A7）
# =========================

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    """
    算数専用・拍照批改 API

    返回内容：
    - is_correct（用于前端画圈/叉）
    - error_message（按年级友好化）
    - similar_exercises（错题练习）
    """
    try:
        # 读取图片
        img_bytes = await image.read()
        ct = image.content_type or "image/jpeg"
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{ct};base64,{b64}"

        # 算数特化 Prompt（弱推断，稳定）
        prompt = """
你是一个小学算数作业批改助手。

请只做以下事情：
1. 从图片中找出所有算数算式（可能有多行）
2. 提取算式（不包含等号右边）
3. 提取学生写的答案（等号右边）

只处理加减乘除。
不处理国语或英语。
不解释，不扩展。

返回 JSON：
{
  "detected_grade": "小1〜小6 または null",
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
        detected_grade = parsed.get("detected_grade")

        problems = []

        for it in items:
            expr = it.get("expression", "").strip()
            student = it.get("student_answer", "").strip()
            correct = eval_expression(expr)

            if not expr or not student or not correct:
                continue

            is_correct = student == correct
            error_type = ""
            error_message = ""
            similar_exercises: List[str] = []

            if not is_correct:
                error_type = classify_math_error(expr, student, correct)
                error_message = format_error_message(error_type, detected_grade)
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

        return {
            "problems": problems,
            "summary": summary,
        }

    except Exception:
        # 任何异常都不允许影响前端
        return {
            "problems": [],
            "summary": {
                "total": 0,
                "correct": 0,
                "wrong": 0,
            },
        }
