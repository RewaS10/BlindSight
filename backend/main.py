from fastapi import FastAPI, UploadFile, File
import shutil
import os

from services.ocr_service import extract_text
from services.threat_detector import analyze_text
from models.response_models import ScanResponse
from utils.logger import logger
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def home():
    return {
        "message": "BlindSight OCR Backend Running"
    }


@app.post("/scan", response_model=ScanResponse)
async def scan_image(file: UploadFile = File(...)):

    try:

        file_path = f"{UPLOAD_DIR}/{file.filename}"

        logger.info(f"Received file: {file.filename}")

        # Save uploaded image
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # OCR extraction
        extracted_text = extract_text(file_path)

        logger.info(f"OCR extracted text: {extracted_text}")

        # Threat analysis
        analysis_result = analyze_text(extracted_text)

        logger.info(
            f"Threat analysis completed for: {file.filename}"
        )

        return {
            "filename": file.filename,
            "text": extracted_text,
            "analysis": analysis_result
        }

    except Exception as e:

        logger.error(f"Error processing file: {str(e)}")

        return {
            "filename": file.filename,
            "text": "",
            "analysis": {
                "risk_score": 0,
                "severity": "error",
                "reasons": [
                    f"Failed to process image: {str(e)}"
                ]
            }
        }