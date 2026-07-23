"""
RCT-Reviewer Web Platform — API layer
--------------------------------------
FastAPI wrapper around the RCT-Reviewer ML pipeline (rct_reviewer package),
which is itself a modernized reimplementation of RobotReviewer
(Marshall, Kuiper, Wallace 2017) — GNU GPL v3.0.

Exposes:
  POST /api/analyze        -> upload PDF(s), run RCT/PICO/Bias pipeline
  POST /api/highlight/bias -> generate bias-highlighted PDF for a document
  POST /api/highlight/pico -> generate PICO-highlighted PDF for a document
  GET  /api/health         -> model load status
"""
import io
import logging
import time
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

import fitz  # PyMuPDF

from rct_reviewer.core.pdf_parser import PDFParser
from rct_reviewer.ml.rct_robot import RCTRobot
from rct_reviewer.ml.pico_robot import PICORobot
from rct_reviewer.ml.bias_robot import BiasRobot

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("rct-reviewer-api")

app = FastAPI(
    title="RCT-Reviewer API",
    description="Automated Risk of Bias & PICO extraction for clinical trial PDFs.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Lazy, cached model loading (mirrors @st.cache_resource behaviour from app.py)
# ---------------------------------------------------------------------------
_MODELS = {}
_PARSER = None
_LOAD_ERROR = None


def get_models():
    global _MODELS, _LOAD_ERROR
    if not _MODELS and _LOAD_ERROR is None:
        try:
            t0 = time.time()
            _MODELS = {
                "rct": RCTRobot(),
                "pico": PICORobot(),
                "bias": BiasRobot(),
            }
            log.info(f"Models loaded in {time.time() - t0:.1f}s")
        except Exception as e:
            _LOAD_ERROR = str(e)
            log.error(f"Model load failed: {e}", exc_info=True)
            raise
    return _MODELS


def get_parser():
    global _PARSER
    if _PARSER is None:
        _PARSER = PDFParser()
    return _PARSER


# In-memory store of last-parsed documents, keyed by a session-supplied id,
# so the highlight endpoints can re-annotate the original PDF bytes without
# re-uploading. Swap this for Redis/S3 in a real multi-instance deployment.
_DOC_CACHE: dict = {}


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class RCTResult(BaseModel):
    is_rct: bool
    score: float
    probability: float
    model: str


class PICOResult(BaseModel):
    domain: str
    text: List[str]


class BiasResult(BaseModel):
    domain: str
    judgement: str
    text: List[str]


class AnalyzeResult(BaseModel):
    doc_id: str
    filename: str
    rct: RCTResult
    pico: List[PICOResult]
    bias: List[BiasResult]


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health", response_model=HealthResponse)
def health():
    try:
        get_models()
        return HealthResponse(status="ok", models_loaded=True)
    except Exception as e:
        return HealthResponse(status="degraded", models_loaded=False, error=str(e))


@app.post("/api/analyze", response_model=List[AnalyzeResult])
async def analyze(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "No files uploaded")

    parser = get_parser()
    models = get_models()
    results = []

    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(400, f"{f.filename} is not a PDF")

        pdf_bytes = await f.read()
        try:
            parsed = parser.parse(pdf_bytes)
        except Exception as e:
            raise HTTPException(422, f"Could not parse {f.filename}: {e}")

        if not parsed["sentences"]:
            raise HTTPException(422, f"No extractable text in {f.filename}")

        rct_res = models["rct"].predict(parsed["title"], parsed["abstract"])
        pico_res = models["pico"].annotate(parsed["sentences"])
        bias_res = models["bias"].annotate(parsed["sentences"], parsed["text"])

        doc_id = f"{f.filename}-{int(time.time() * 1000)}"
        _DOC_CACHE[doc_id] = {"pdf_bytes": pdf_bytes, "bias": bias_res, "pico": pico_res}

        results.append(
            AnalyzeResult(
                doc_id=doc_id,
                filename=f.filename,
                rct=RCTResult(**rct_res),
                pico=[PICOResult(domain=p["domain"], text=p["text"]) for p in pico_res],
                bias=[BiasResult(domain=b["domain"], judgement=b["judgement"], text=b["text"]) for b in bias_res],
            )
        )

    return results


BIAS_COLORS = {
    "Random sequence generation": (1.0, 0.6, 0.6),
    "Allocation concealment": (1.0, 0.3, 0.3),
    "Blinding of participants and personnel": (0.86, 0.08, 0.24),
    "Blinding of outcome assessment": (0.8, 0.4, 0.0),
    "Incomplete outcome data": (0.8, 0.2, 0.2),
    "Selective reporting": (0.5, 0.0, 0.0),
}
PICO_COLORS = {
    "Population": (1.0, 0.84, 0.0),
    "Intervention": (1.0, 0.6, 0.2),
    "Outcomes": (1.0, 0.5, 0.31),
}


def _highlight_pdf(pdf_bytes: bytes, spans: list, colors: dict, header_label: str) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    for page in doc:
        page.insert_text(fitz.Point(10, 15), f"{header_label} — generated {stamp}", fontsize=9, color=(0.2, 0.2, 0.2))

    for span in spans:
        text, key = span["text"], span["key"]
        if not text or len(text) < 10:
            continue
        color = colors.get(key, (1.0, 0.3, 0.3))
        for page in doc:
            try:
                for area in page.search_for(text):
                    hl = page.add_highlight_annot(area)
                    hl.set_colors(stroke=color)
                    hl.update()
            except Exception:
                continue

    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


@app.post("/api/highlight/bias")
def highlight_bias(doc_id: str = Form(...)):
    doc = _DOC_CACHE.get(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found — re-run /api/analyze first")
    spans = [{"text": t, "key": b["domain"]} for b in doc["bias"] for t in b["text"]]
    pdf = _highlight_pdf(doc["pdf_bytes"], spans, BIAS_COLORS, "RCT-Reviewer: Bias highlights")
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                              headers={"Content-Disposition": f'attachment; filename="bias_{doc_id}.pdf"'})


@app.post("/api/highlight/pico")
def highlight_pico(doc_id: str = Form(...)):
    doc = _DOC_CACHE.get(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found — re-run /api/analyze first")
    spans = [{"text": t, "key": p["domain"]} for p in doc["pico"] for t in p["text"]]
    pdf = _highlight_pdf(doc["pdf_bytes"], spans, PICO_COLORS, "RCT-Reviewer: PICO highlights")
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                              headers={"Content-Disposition": f'attachment; filename="pico_{doc_id}.pdf"'})


@app.get("/")
def root():
    return JSONResponse({"name": "RCT-Reviewer API", "docs": "/docs"})
