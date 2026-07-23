"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./Uploader.module.css";

export default function Uploader({
  onAnalyze,
  busy,
}: {
  onAnalyze: (files: File[]) => Promise<void>;
  busy: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter((f) => f.type === "application/pdf");
    if (pdfs.length !== incoming.length) {
      setError("Only PDF files are accepted — non-PDF files were skipped.");
    } else {
      setError(null);
    }
    setFiles((prev) => [...prev, ...pdfs]);
  }, []);

  return (
    <div>
      <div
        className={`${styles.dropzone} ${active ? styles.active : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setActive(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <h3>Drop trial reports here</h3>
        <p>or click to browse — PDF, one or more files</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className={styles.fileInput}
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((f, i) => (
            <div className={styles.fileRow} key={`${f.name}-${i}`}>
              <span>{f.name}</span>
              <button
                className={styles.remove}
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              >
                remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.analyzeBtn}
          disabled={files.length === 0 || busy}
          onClick={() => onAnalyze(files)}
        >
          {busy ? "Analyzing…" : "Analyze documents"}
        </button>
        <span className="mono-label">{files.length} file{files.length === 1 ? "" : "s"} queued</span>
      </div>
    </div>
  );
}
