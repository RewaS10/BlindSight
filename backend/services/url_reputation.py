from dotenv import load_dotenv

import os
import requests
import base64

load_dotenv()

API_KEY = os.getenv("API_KEY")

VT_URL = (
    "https://www.virustotal.com/api/v3/urls"
)

HEADERS = {
    "x-apikey": API_KEY
}


def check_url_reputation(url: str):

    try:

        encoded_url = base64.urlsafe_b64encode(
            url.encode()
        ).decode().strip("=")

        response = requests.get(
            f"{VT_URL}/{encoded_url}",
            headers=HEADERS,
            timeout=8
        )

        if response.status_code != 200:

            return {
                "malicious": 0,
                "suspicious": 0,
                "harmless": 0,
            }

        data = response.json()

        stats = data["data"][
            "attributes"
        ]["last_analysis_stats"]

        return {
            "malicious":
                stats.get(
                    "malicious",
                    0
                ),

            "suspicious":
                stats.get(
                    "suspicious",
                    0
                ),

            "harmless":
                stats.get(
                    "harmless",
                    0
                ),
        }

    except Exception as e:

        print(
            f"VirusTotal Error: {e}"
        )

        return {
            "malicious": 0,
            "suspicious": 0,
            "harmless": 0,
        }