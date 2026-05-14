from pydantic import BaseModel
from typing import List


class ThreatAnalysis(BaseModel):

    risk_score: int

    severity: str

    reasons: List[str]

    detected_urls: List[str]

    summary: str

    advice: List[str]


class ScanResponse(BaseModel):

    filename: str

    text: str

    analysis: ThreatAnalysis