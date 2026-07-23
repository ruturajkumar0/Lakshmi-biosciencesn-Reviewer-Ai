# Model weights

This folder currently contains **Git LFS pointer files**, not the real trained
weights — my sandboxed environment could not reach `github-cloud.githubusercontent.com`
or `huggingface.co` (both are blocked by network policy) to pull the actual
`.joblib` / `.npz` / `.pck` binaries. The API will start and serve traffic, but
`/api/analyze` will return a 500 and `/api/health` will report `degraded` until
real weights are in place.

The pipeline only strictly needs these files (used by `app.py`'s SVM-only path):

```
data/rct/rct_svm_weights.npz
data/rct/rct_model_calibration.json
data/rct/svm_cnn_calibration.joblib
data/rct/svm_cnn_ptyp_calibration.joblib
data/pico/P_model.npz   data/pico/P_idf.npz
data/pico/I_model.npz   data/pico/I_idf.npz
data/pico/O_model.npz   data/pico/O_idf.npz
data/bias/bias_sent_level.npz
data/bias/bias_doc_level.npz
data/drugbank/drugbank.joblib
```

(The CNN `.h5` files, `minimap/`, `pubmed/`, `punchlines/`, `sample_size/` are
unused by this API and can stay as pointers.)

## Option A — pull via Git LFS (recommended, do this on your own machine/CI)

```bash
git clone https://github.com/aurumz-rgb/RCT-Reviewer.git
cd RCT-Reviewer
git lfs install
git lfs pull
# then copy the populated data/ folder over this one:
cp -r data/* /path/to/rct-platform/backend/data/
```

## Option B — pull from the Hugging Face mirror

```bash
pip install huggingface_hub
python -c "
from huggingface_hub import snapshot_download
snapshot_download(repo_id='Aurumz/RCT-Reviewer', local_dir='hf_data')
"
# then map the downloaded files into backend/data/ following the layout above
```

## Verifying

```bash
cd backend
uvicorn api.main:app --reload
curl localhost:8000/api/health
# {"status":"ok","models_loaded":true}   <- once weights are in place
```

Once real weights are dropped in, no code changes are needed — `RCTRobot`,
`PICORobot`, and `BiasRobot` load lazily on first request.
