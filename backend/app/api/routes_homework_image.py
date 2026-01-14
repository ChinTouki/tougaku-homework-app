import os
import re
import base64
import json
from fractions import Fraction

from fastapi import APIRouter, UploadFile, File
from openai import OpenAI

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# -------------------------
# utils
# -------------------------

def safe_parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        return {}

def parse_fraction(s: str):
    s = s.strip()
    try:
        if " " in s and "/" in s:
            w, f = s.split()
            n, d = f.split("/")
            return Fraction(int(w) * int(d) + int(n), int(d))
        if "/" in s:
            n, d = s.split("/")
            return Fraction(int(n), int(d))
        return Fraction(int(s), 1)
    except Exception:
        return None

def eval_expr(expr: str):
    try:
        expr = expr.replace("×", "*").replace("÷", "/")
        expr = re.sub(r"(\d+)\s*/\s*(\d+)", r"Fraction(\1,\2)", expr)
        return eval(expr, {"Fraction": Fraction})
    except Exception:
        return None

# -------------------------
# API
# -------------------------

@router.post("/check_homework_image")
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()
    ct = image.content_type or "image/jpeg"
    b64 = base64.b64encode(img_bytes).decode()
    data_url = f"data:{ct};base64,{b64}"

    # ========= ① JSON 方式 =========
    prompt_json = """
你是小学算数作业批改助手。
请逐行识别图片中的算式。

JSONで返してください：
{
  "items": [
    { "expression": "3 1/2 + 2", "student_answer": "5 1/2" }
  ]
}
"""

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.2,
        messages=[
            {"role": "system", "content": "只返回JSON"},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_json},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    )

    parsed = safe_parse_json(res.choices[0].message.content)
    items = parsed.get("items", [])

    # ========= ② 兜底：纯文本 =========
    if not items:
        prompt_text = """
请把图片里的所有算数算式逐行写出来。
只写算式本身，例如：
1 + 5 = 6
3 1/2 + 2 = 5 1/2
8 ÷ 2 = 4
6 × 3 = 15
"""

        res2 = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
        )

        text = res2.choices[0].message.content or ""
        lines = [l for l in text.splitlines() if "=" in l]

        for l in lines:
            left, right = l.split("=", 1)
            items.append({
                "expression": left.strip(),
                "student_answer": right.strip()
            })

    # ========= ③ 判定 =========
    problems = []
    for it in items:
        expr = it["expression"]
        student = it["student_answer"]

        correct_val = eval_expr(expr)
        student_val = parse_fraction(student)

        if correct_val is None or student_val is None:
            continue

        problems.append({
            "expression": expr,
            "student_answer": student,
            "correct_answer": str(correct_val),
            "is_correct": correct_val == student_val,
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
