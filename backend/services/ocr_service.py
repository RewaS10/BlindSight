import pytesseract

from PIL import Image

import os


pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


def extract_text(image_path: str):

    try:

        if not os.path.exists(image_path):

            return ""

        image = Image.open(image_path)

        text = pytesseract.image_to_string(
            image,
            config="--psm 6"
        )

        return text.strip()

    except Exception as e:

        print(f"OCR Error: {e}")

        return ""