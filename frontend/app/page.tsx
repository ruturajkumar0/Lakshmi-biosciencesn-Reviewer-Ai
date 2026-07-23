"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import Uploader from "@/components/Uploader";
import ResultCard from "@/components/ResultCard";
import { analyzeFiles, checkHealth, AnalyzeResult } from "@/lib/api";

export default function Home() {
  const [results, setResults] = useState<AnalyzeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ status: string; error?: string } | null>(null);

  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch(() => setHealth({ status: "unreachable" }));
  }, []);

  async function handleAnalyze(files: File[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await analyzeFiles(files);
      setResults(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Third-party tiebreaker reference</p>
        <h1 className={styles.title}>
          A second opinion for <em>risk-of-bias</em> judgements
        </h1>
        <p className={styles.lede}>
          Upload a clinical trial report. RCT Reviewer extracts Population, Intervention and Outcome
          statements, then scores each of the six Cochrane risk-of-bias domains — the same reference
          check two disagreeing reviewers can use to break a tie.
        </p>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statNum}>71.0%</span>
            <span className={styles.statLabel}>Agreement with expert consensus</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>87 / 90</span>
            <span className={styles.statLabel}>Precision / recall on evidence spans</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>12,808</span>
            <span className={styles.statLabel}>RCTs in training corpus</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        {health && health.status !== "ok" && (
          <div className={`${styles.banner} ${styles.bannerWarn}`}>
            Backend model service isn&apos;t fully loaded{health.error ? `: ${health.error}` : "."} Analysis
            will fail until model weights are in place on the API server.
          </div>
        )}
        {health && health.status === "ok" && (
          <div className={`${styles.banner} ${styles.bannerOk}`}>Model service is loaded and ready.</div>
        )}

        <Uploader onAnalyze={handleAnalyze} busy={busy} />
        {error && <p style={{ color: "var(--risk-high)", marginTop: 12, fontSize: 13.5 }}>{error}</p>}

        {results.length > 0 && (
          <>
            <p className={styles.summary}>
              {results.length} document{results.length === 1 ? "" : "s"} analyzed ·{" "}
              {results.filter((r) => r.rct.is_rct).length} identified as RCTs
            </p>
            {results.map((r) => (
              <ResultCard key={r.doc_id} result={r} />
            ))}
          </>
        )}
      </section>

      <footer className={styles.footer}>
        <p>
          Built on the same ML pipeline as{" "}
          <a href="https://github.com/aurumz-rgb/RCT-Reviewer" target="_blank" rel="noreferrer">
            RCT-Reviewer
          </a>
          , a modernized, standalone reimplementation of RobotReviewer (Marshall, Kuiper, Banner &amp;
          Wallace, ACL 2017), distributed under GNU GPL v3.0. Judgements are a third-opinion reference
          only and do not replace independent human review.
        </p>
      </footer>
    </main>
  );
}
