export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type RCTResult = {
  is_rct: boolean;
  score: number;
  probability: number;
  model: string;
};

export type PICOResult = {
  domain: "Population" | "Intervention" | "Outcomes";
  text: string[];
};

export type BiasResult = {
  domain: string;
  judgement: string;
  text: string[];
};

export type AnalyzeResult = {
  doc_id: string;
  filename: string;
  rct: RCTResult;
  pico: PICOResult[];
  bias: BiasResult[];
};

export async function analyzeFiles(files: File[]): Promise<AnalyzeResult[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Analysis failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export function highlightUrl(kind: "bias" | "pico") {
  return `${API_BASE}/api/highlight/${kind}`;
}

export async function checkHealth(): Promise<{ status: string; models_loaded: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
  return res.json();
}
