# RCT Reviewer — Web Platform

A web-app version of [RCT-Reviewer](https://github.com/aurumz-rgb/RCT-Reviewer) —
automated PICO extraction and Cochrane-domain Risk of Bias assessment for
randomized controlled trial PDFs, built as a third-party tiebreaker reference
for systematic reviews.

This repackages the same ML pipeline (SVM classifiers over hashed n-gram
features, distant-supervision trained by Marshall/Kuiper/Wallace on 12,808
RCTs) behind a REST API, with a Next.js front end instead of the original
Streamlit interface, so it can run as two independently deployable services
(e.g. Vercel + Render/Railway/Fly).

```
rct-platform/
├── backend/            FastAPI service — PDF parsing + ML inference
│   ├── api/main.py     REST endpoints (/api/analyze, /api/highlight/*)
│   ├── rct_reviewer/    the ML pipeline package (pdf parser, RCT/PICO/Bias robots)
│   ├── data/            model weights — see data/README.md, currently LFS pointers
│   ├── Dockerfile
│   └── render.yaml
└── frontend/            Next.js 16 app (App Router)
    ├── app/page.tsx      upload UI + results
    ├── components/       Uploader, ResultCard
    ├── lib/api.ts         backend client
    └── vercel.json
```

## ⚠️ Model weights not included

The real trained weights (`.npz` / `.joblib` / `.pck`) live in the original
repo's Git LFS storage and on Hugging Face. Both hosts were unreachable from
the sandbox this was built in, so `backend/data/` currently holds LFS pointer
files, not the binaries. **Read `backend/data/README.md`** for the two ways to
pull the real weights — it's a five-minute step once you have normal internet
access, and no code changes are required afterward.

Until then, the full app runs end-to-end (upload, parsing, UI, PDF
highlighting, exports) but `/api/analyze` returns a clear error and the
frontend shows a "model service isn't loaded" banner instead of judgements.

## Running locally

**Backend**
```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
cp .env.local.example .env.local   # points at http://localhost:8000
npm install
npm run dev
```

Open `http://localhost:3000`, upload a trial PDF, click **Analyze documents**.

## Deploying

- **Frontend → Vercel**: import `frontend/` as the project root, set
  `NEXT_PUBLIC_API_BASE_URL` to your deployed backend URL. `vercel.json` is
  already configured.
- **Backend → Render / Railway / Fly**: any Docker host works — `Dockerfile`
  is included; `render.yaml` is a ready-to-use Render blueprint. Avoid Vercel
  serverless functions for the backend: PyMuPDF + spaCy + scikit-learn exceed
  serverless size/cold-start limits comfortably handled by a small always-on
  container instead.

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | model load status |
| `/api/analyze` | POST (multipart, `files[]`) | run RCT/PICO/Bias pipeline on one or more PDFs |
| `/api/highlight/bias` | POST (form `doc_id`) | download bias-highlighted PDF |
| `/api/highlight/pico` | POST (form `doc_id`) | download PICO-highlighted PDF |

Interactive docs at `/docs` once the backend is running.

## License & attribution

This is a derivative of RCT-Reviewer, itself a derivative of RobotReviewer
(Marshall, Kuiper, Banner & Wallace, ACL 2017), and inherits the **GNU GPL
v3.0** license — see `LICENSE.txt`. If you publish or deploy this, keep the
attribution to RobotReviewer and RCT-Reviewer, and cite the original papers
(listed in `backend/rct_reviewer` docstrings / the RCT-Reviewer README) in
any academic use.
