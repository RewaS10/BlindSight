from __future__ import annotations

import re
import unicodedata

from dataclasses import dataclass, field
from typing import Optional

from services.url_reputation import check_url_reputation


# ─────────────────────────────────────
# Data Models
# ─────────────────────────────────────

@dataclass
class _Signal:
    reason: str
    weight: int


@dataclass
class _AnalysisState:

    signals: list[_Signal] = field(default_factory=list)

    detected_urls: list[str] = field(default_factory=list)

    detected_brand: Optional[str] = None

    def add(self, reason: str, weight: int):

        self.signals.append(
            _Signal(
                reason=reason,
                weight=weight
            )
        )

    @property
    def total_score(self):

        return min(
            sum(s.weight for s in self.signals),
            100
        )

    @property
    def reasons(self):

        seen = set()
        unique = []

        for s in self.signals:

            if s.reason not in seen:

                seen.add(s.reason)
                unique.append(s.reason)

        return unique


# ─────────────────────────────────────
# Config
# ─────────────────────────────────────

SEVERITY_HIGH = 60
SEVERITY_MEDIUM = 30


BRAND_DOMAINS = {

    "paypal": ["paypal.com"],

    "microsoft": [
        "microsoft.com",
        "office.com",
        "live.com",
        "outlook.com",
    ],

    "google": [
        "google.com",
    ],

    "apple": [
        "apple.com",
        "icloud.com",
    ],

    "amazon": [
        "amazon.com",
    ],

    "rackspace": [
        "rackspace.com",
    ],

    "bank": [],
}


SUSPICIOUS_TLDS = {

    ".ru",
    ".xyz",
    ".tk",
    ".top",
    ".click",
    ".zip",
    ".work",
    ".loan",
}


SHORTENER_HOSTS = {

    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "cutt.ly",
}


GENERIC_GREETINGS = [

    r"\bdear\s+(customer|user|client)\b",

    r"\bvalued\s+customer\b",

    r"\bhello\s+user\b",
]


URGENCY_PATTERNS = [

    r"\burgent\b",

    r"\bimmediately\b",

    r"\bact\s+now\b",

    r"\bverify\s+immediately\b",

    r"\bfinal\s+warning\b",

    r"\baccount\s+suspended\b",

    r"\brespond\s+within\b",
]


FEAR_PATTERNS = [

    r"\baccount\s+locked\b",

    r"\bsecurity\s+alert\b",

    r"\bunauthorized\s+login\b",

    r"\baccount\s+restricted\b",

    r"\bsecurity\s+breach\b",
]


CREDENTIAL_PATTERNS = [

    r"\bpassword\b",

    r"\botp\b",

    r"\bpin\b",

    r"\bcvv\b",

    r"\bverification\s+code\b",

    r"\bbank\s+details\b",

    r"\bcredit\s+card\b",
]


SOCIAL_PATTERNS = [

    r"\bclick\s+here\b",

    r"\bdownload\s+attachment\b",

    r"\bclaim\s+reward\b",

    r"\bcongratulations\b",

    r"\bkeep\s+this\s+secret\b",
]


# ─────────────────────────────────────
# Normalize Text
# ─────────────────────────────────────

def _normalize(text: str):

    text = unicodedata.normalize(
        "NFKD",
        text
    )

    text = (
        text
        .encode(
            "ascii",
            errors="ignore"
        )
        .decode("ascii")
    )

    substitutions = str.maketrans({

        "@": "a",
        "0": "o",
        "1": "l",
        "3": "e",
        "$": "s",
    })

    text = (
        text
        .lower()
        .translate(substitutions)
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# ─────────────────────────────────────
# URL Helpers
# ─────────────────────────────────────

_URL_RE = re.compile(
    r"(https?://[^\s]+|www\.[^\s]+)",
    re.IGNORECASE,
)

_IP_RE = re.compile(
    r"https?://(\d{1,3}\.){3}\d{1,3}",
    re.IGNORECASE,
)


def _extract_urls(text: str):

    found = _URL_RE.findall(text)

    cleaned = []

    for url in found:

        url = url.rstrip(".,;!?)")

        if url not in cleaned:
            cleaned.append(url)

    return cleaned


def _url_host(url: str):

    url = re.sub(
        r"^https?://",
        "",
        url
    )

    return (
        url
        .split("/")[0]
        .lower()
    )


def _is_shortener(url: str):

    host = _url_host(url)

    return any(

        host == s
        or host.endswith("." + s)

        for s in SHORTENER_HOSTS
    )


# ─────────────────────────────────────
# Generic Pattern Scoring
# ─────────────────────────────────────

def _score_patterns(

    lower: str,
    patterns: list[str],
    reason: str,
    weight: int,
    state: _AnalysisState,
):

    for pattern in patterns:

        if re.search(pattern, lower):

            state.add(
                reason,
                weight
            )

            break


# ─────────────────────────────────────
# Brand Impersonation
# ─────────────────────────────────────

def _score_brand_impersonation(

    lower: str,
    urls: list[str],
    state: _AnalysisState,
):

    detected_brand = None

    for brand in BRAND_DOMAINS:

        if re.search(
            rf"\b{re.escape(brand)}\b",
            lower
        ):

            detected_brand = brand

            state.detected_brand = brand

            state.add(

                f"The message mentions "
                f"{brand.title()}, which is "
                f"commonly impersonated in "
                f"phishing attacks.",

                5,
            )

            break

    if not detected_brand:
        return

    legitimate_domains = (
        BRAND_DOMAINS[
            detected_brand
        ]
    )

    for url in urls:

        host = _url_host(url)

        legit = any(

            domain in host

            for domain
            in legitimate_domains
        )

        if not legit:

            state.add(

                f"The message claims to "
                f"be from "
                f"{detected_brand.title()} "
                f"but links to "
                f"'{host}', which does not "
                f"match the official domain.",

                40,
            )


# ─────────────────────────────────────
# URL Analysis
# ─────────────────────────────────────

def _score_urls(

    urls: list[str],
    state: _AnalysisState,
):

    for url in urls:

        host = _url_host(url)

        # ─────────────────────────
        # VirusTotal Reputation
        # ─────────────────────────

        try:

            reputation = (
                check_url_reputation(url)
            )

            malicious = reputation.get(
                "malicious",
                0
            )

            suspicious = reputation.get(
                "suspicious",
                0
            )

            harmless = reputation.get(
                "harmless",
                0
            )

            if malicious >= 5:

                state.add(

                    f"This URL was flagged "
                    f"as malicious by "
                    f"{malicious} security vendors.",

                    50,
                )

            elif malicious > 0 or suspicious > 0:

                state.add(

                    "This URL appears suspicious "
                    "according to online "
                    "threat intelligence systems.",

                    30,
                )

            elif harmless == 0:

                state.add(

                    "This URL could not be verified "
                    "by threat intelligence services.",

                    10,
                )

        except Exception as e:

            print(f"VirusTotal Error: {e}")

        # ─────────────────────────
        # IP Address URLs
        # ─────────────────────────

        if _IP_RE.search(url):

            state.add(

                "This link uses a raw IP address "
                "instead of a normal domain name.",

                30,
            )

        # ─────────────────────────
        # URL Shorteners
        # ─────────────────────────

        if _is_shortener(url):

            state.add(

                "This link uses a URL shortener "
                "to hide its real destination.",

                20,
            )

        # ─────────────────────────
        # Suspicious TLD
        # ─────────────────────────

        for tld in SUSPICIOUS_TLDS:

            if host.endswith(tld):

                state.add(

                    f"The domain extension "
                    f"'{tld}' is frequently "
                    f"used in phishing attacks.",

                    22,
                )

                break

        # ─────────────────────────
        # Hyphen Abuse
        # ─────────────────────────

        if host.count("-") >= 3:

            state.add(

                "The website address uses "
                "unusual formatting commonly "
                "seen in fake websites.",

                12,
            )

        # ─────────────────────────
        # Long Subdomains
        # ─────────────────────────

        if len(host.split(".")) > 4:

            state.add(

                "The URL is unusually long "
                "and complex, which is "
                "common in phishing attacks.",

                15,
            )


# ─────────────────────────────────────
# Advice Generator
# ─────────────────────────────────────

def _generate_advice(severity):

    if severity == "high":

        return [

            "Do not click any links.",

            "Do not reply to this message.",

            "Do not enter passwords or OTPs.",

            "Delete the message immediately.",

            "Contact the company using "
            "their official website only.",
        ]

    elif severity == "medium":

        return [

            "Verify the sender carefully.",

            "Avoid opening suspicious links.",

            "Double-check the website domain.",

            "Be cautious before sharing information.",
        ]

    return [

        "No major phishing indicators detected.",

        "Remain cautious with unexpected messages.",
    ]


# ─────────────────────────────────────
# Summary Builder
# ─────────────────────────────────────

def _build_summary(

    severity: str,
    score: int,
):

    if severity == "high":

        return (

            f"Warning. This message strongly "
            f"resembles a phishing or scam "
            f"attempt. Risk score: {score}/100."
        )

    elif severity == "medium":

        return (

            f"Caution. This message contains "
            f"suspicious elements commonly "
            f"used in phishing attacks. "
            f"Risk score: {score}/100."
        )

    return (

        f"No major phishing indicators "
        f"were detected. Risk score: "
        f"{score}/100."
    )


# ─────────────────────────────────────
# Main Analysis
# ─────────────────────────────────────

def analyze_text(text: str):

    if not text or len(text.strip()) < 10:

        return {

            "risk_score": 0,

            "severity": "low",

            "reasons": [
                "No readable text was found."
            ],

            "detected_urls": [],

            "summary": (
                "The screenshot did not "
                "contain enough readable "
                "text to analyze."
            ),

            "advice": [
                "Try a clearer screenshot."
            ],
        }

    lower = _normalize(text)

    urls = _extract_urls(text)

    state = _AnalysisState(
        detected_urls=urls
    )

    # ─────────────────────────
    # Greetings
    # ─────────────────────────

    _score_patterns(

        lower,

        GENERIC_GREETINGS,

        "The message uses a generic greeting "
        "instead of your name.",

        10,

        state,
    )

    # ─────────────────────────
    # Urgency
    # ─────────────────────────

    _score_patterns(

        lower,

        URGENCY_PATTERNS,

        "The message creates urgency "
        "to pressure quick action.",

        20,

        state,
    )

    # ─────────────────────────
    # Fear
    # ─────────────────────────

    _score_patterns(

        lower,

        FEAR_PATTERNS,

        "The message uses fear tactics "
        "such as account suspension "
        "or security alerts.",

        25,

        state,
    )

    # ─────────────────────────
    # Credentials
    # ─────────────────────────

    _score_patterns(

        lower,

        CREDENTIAL_PATTERNS,

        "The message requests sensitive "
        "information such as passwords "
        "or OTPs.",

        30,

        state,
    )

    # ─────────────────────────
    # Social Engineering
    # ─────────────────────────

    _score_patterns(

        lower,

        SOCIAL_PATTERNS,

        "The message uses social "
        "engineering tactics.",

        18,

        state,
    )

    # ─────────────────────────
    # Brand Impersonation
    # ─────────────────────────

    _score_brand_impersonation(

        lower,
        urls,
        state,
    )

    # ─────────────────────────
    # URL Analysis
    # ─────────────────────────

    _score_urls(
        urls,
        state,
    )

    # ─────────────────────────
    # Final Score
    # ─────────────────────────

    final_score = state.total_score

    if final_score >= SEVERITY_HIGH:

        severity = "high"

    elif final_score >= SEVERITY_MEDIUM:

        severity = "medium"

    else:

        severity = "low"

    summary = _build_summary(
        severity,
        final_score,
    )

    advice = _generate_advice(
        severity
    )

    return {

        "risk_score":
            final_score,

        "severity":
            severity,

        "reasons":
            state.reasons,

        "detected_urls":
            state.detected_urls,

        "summary":
            summary,

        "advice":
            advice,
    }