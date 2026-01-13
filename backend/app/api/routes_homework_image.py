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
# 表达式标准化（关键）
# =========================

def normalize_expression(expr: str) -> str:
    """
    把人写的算式统一成 Python 可算形式
    """
    expr = expr.replace("×", "*").replace("÷", "/")
    expr = expr.replace("−", "-")

    # 处理带分数：3 1/2 -> 3.5
    mixed = re.match(r"(\d+)\s+(\d+)/(\d+)", expr)
    if mixed:
        whole = int(mixed.group(1))
        num = int(mixed.group(2))
        den = int(mixed.group(3))
        expr = str(whole + num / den)

    return expr.strip()

# =========================
# 安全计算
# =========================

def eval_expression(expr: str) -> str:
    try:
        expr = normalize_expression(expr)
        if not re.match(r"^[0-9+\-*/(). ]+$", expr):
            return ""
        result = eval(expr, {"__builtins__": {}})
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        return str(result)
    except Exception:
        return ""

# =========================
# API：算数拍照批改（多题支持）
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

【非常重要】
- 图片中每一行算式都要单独识别
- 不要合并，不要省略
- 即使算式复杂，也要原样提取

【要做的事】
1. 按“行”拆解所有算式
2. 提取算式（等号左边）
3. 提取学生写的答案（等号右边）

【支持】
- 分数（如 3 1/2）
- × ÷

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
            raw_expr = it.get("expression", "").strip()
            student = it.get("student_answer", "").strip()

            if not raw_expr or not student:
                continue

            correct = eval_expression(raw_expr)
            is_correct = correct != "" and student.replace(" ", "") == correct.replace(" ", "")

            problems.append({
                "expression": raw_expr,
                "student_answer": student,
                "correct_answer": correct,
                "is_correct": is_correct,
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
