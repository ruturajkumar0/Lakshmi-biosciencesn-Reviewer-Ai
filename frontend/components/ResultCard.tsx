"use client";

import { useState } from "react";
import styles from "./ResultCard.module.css";
import { AnalyzeResult, highlightUrl } from "@/lib/api";

const PICO_ORDER = ["Population", "Intervention", "Outcomes"] as const;

export default function ResultCard({ result }: { result: AnalyzeResult }) {
  const [downloading, setDownloading] = useState<"bias" | "pico" | null>(null);

  async function download(kind: "bias" | "pico") {
    setDownloading(kind);
    try {
      const form = new FormData();
      form.append("doc_id", result.doc_id);
      const res = await fetch(highlightUrl(kind), { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}_${result.filename}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Could not generate ${kind} PDF: ${(e as Error).message}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <p className={styles.filename}>{result.filename}</p>
        <span className={`${styles.rctBadge} ${result.rct.is_rct ? styles.rctYes : styles.rctNo}`}>
          {result.rct.is_rct ? "Identified as RCT" : "Not identified as RCT"} · p=
          {result.rct.probability.toFixed(2)}
        </span>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>PICO extraction</p>
        <div className={styles.picoGrid}>
          {PICO_ORDER.map((domain) => {
            const d = result.pico.find((p) => p.domain === domain);
            return (
              <div className={styles.picoDomain} key={domain}>
                <h4>{domain}</h4>
                {d && d.text.length > 0 ? (
                  <ul>
                    {d.text.slice(0, 3).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.biasEvidence}>No elements extracted</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Risk of bias — Cochrane domains</p>
        {result.bias.map((b) => (
          <div className={styles.biasRow} key={b.domain}>
            <div>
              <div className={styles.biasDomain}>{b.domain}</div>
              {b.text[0] && <p className={styles.biasEvidence}>&ldquo;{b.text[0].slice(0, 140)}&rdquo;</p>}
            </div>
            <span className={`${styles.judgement} ${b.judgement === "low" ? styles.judgementLow : styles.judgementHigh}`}>
              {b.judgement}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Export</p>
        <div className={styles.downloads}>
          <button className={styles.downloadBtn} onClick={() => download("bias")} disabled={downloading !== null}>
            {downloading === "bias" ? "Generating…" : "Download bias-highlighted PDF"}
          </button>
          <button className={styles.downloadBtn} onClick={() => download("pico")} disabled={downloading !== null}>
            {downloading === "pico" ? "Generating…" : "Download PICO-highlighted PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
