import os
import json
import base64
from typing import Optional

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from google.cloud import vision

router = APIRouter()

# ======================
# Response（调试用）
# ======================

class DebugOCRResponse(BaseModel):
    ocr_text: str
    text_length: int


# ======================
# OCR
# ======================

def google_ocr_text_with_retry(img_bytes: bytes, max_retry: int = 2) -> str:
    creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if not creds_json:
        raise RuntimeError("Missing Google Vision credentials")

    creds = json.loads(creds_json)
    client_vision = vision.ImageAnnotatorClient.from_service_account_info(creds)

    for _ in range(max_retry):
        image = vision.Image(content=img_bytes)
        response = client_vision.text_detection(image=image)

        if response.error.message:
            continue

        texts = response.text_annotations
        if texts and texts[0].description:
            text = texts[0].description.strip()
            if len(text) >= 3:
                return text

    return ""


# ======================
# API（DEBUG）
# ======================

@router.post("/check_homework_image", response_model=DebugOCRResponse)
async def check_homework_image(image: UploadFile = File(...)):
    img_bytes = await image.read()

    try:
        text = google_ocr_text_with_retry(img_bytes)
        return {
            "ocr_text": text,
            "text_length": len(text)
        }
    except Exception as e:
        return {
            "ocr_text": f"ERROR: {str(e)}",
            "text_length": 0
        }
