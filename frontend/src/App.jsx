import { useState, useRef, useCallback } from "react";

const C = {
  bg: "#0a0a0f",
  surface: "#12121a",
  border: "#1e1e2e",
  accent: "#00e5a0",
  accentDim: "#00e5a015",
  accentMid: "#00e5a050",
  warn: "#ff6b6b",
  text: "#e8e8f0",
  muted: "#6b6b8a",
  gold: "#ffd166",
};

function ScoreBar({ score, max }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct > 70 ? C.accent : pct > 40 ? C.gold : C.warn;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.muted }}>{score}/{max}</span>
        <span style={{ fontSize: 11, color }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 1.2s ease" }} />
      </div>
    </div>
  );
}

function Badge({ value }) {
  const map = {
    "Strong Hire": { color: C.accent, bg: C.accentDim, icon: "🚀" },
    "Hire": { color: "#90ee90", bg: "#90ee9015", icon: "✅" },
    "Maybe": { color: C.gold, bg: "#ffd16615", icon: "🤔" },
    "No Hire": { color: C.warn, bg: "#ff6b6b15", icon: "❌" },
  };
  const s = map[value] || map["Maybe"];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 20px", background: s.bg, border: `1px solid ${s.color}40`, borderRadius: 24, color: s.color, fontSize: 15, fontWeight: 700 }}>
      {s.icon} {value}
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const fileRef = useRef();

  const log = useCallback((msg) => {
    setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setFile(f);
  }, []);

  const handleRun = async () => {
    if (!file || !apiKey) return;
    setLoading(true); setError(""); setResult(null); setLogs([]); setProgress(15);
    try {
      log(`→ Uploading ${file.name}...`);
      const form = new FormData();
      form.append("pdf", file);
      form.append("gemini_api_key", apiKey);
      form.append("model", model);

      setProgress(30);
      log("→ Running pipeline: PDF extraction → GitHub enrichment → AI evaluation...");

      const res = await fetch("/evaluate", { method: "POST", body: form });
      setProgress(85);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      log(`✓ Done! Candidate: ${data.candidate_name || "Unknown"}`);
      if (data.github_found) log("✓ GitHub profile enrichment applied");
      setResult(data);
      setProgress(100);
    } catch (e) {
      setError(e.message);
      log(`✗ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, fontSize: 13, padding: "10px 14px", outline: "none",
    fontFamily: "'DM Mono', monospace", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Mono','Courier New',monospace", color: C.text, overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono&family=Syne:wght@800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        input:focus,select:focus{border-color:${C.accentMid}!important;outline:none}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 40px", display: "flex", alignItems: "center", gap: 14, background: C.surface }}>
        <div style={{ width: 34, height: 34, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: "0.05em" }}>HIRING AGENT</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>by HackerRank · AI Resume Scorer</div>
        </div>
        <div style={{ marginLeft: "auto", background: C.accentDim, border: `1px solid ${C.accentMid}`, color: C.accent, fontSize: 11, padding: "4px 12px", borderRadius: 20, letterSpacing: "0.1em" }}>
          LIVE
        </div>
      </header>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "44px 20px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 10, background: `linear-gradient(135deg,${C.text} 40%,${C.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Score Any Resume<br />in Seconds
          </h1>
          <p style={{ color: C.muted, fontSize: 14 }}>Upload PDF → AI extracts + scores across Open Source, Projects, Production & Skills</p>
        </div>

        {/* API Key */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 7, display: "block" }}>Gemini API Key</label>
              <input style={inputStyle} type="password" placeholder="AIzaSy..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 7, display: "block" }}>Model</label>
              <select value={model} onChange={e => setModel(e.target.value)}
                style={{ ...inputStyle, width: "auto", padding: "10px 12px" }}>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 7 }}>Get free key → <a href="https://aistudio.google.com/api-keys" target="_blank" style={{ color: C.accent }}>aistudio.google.com/api-keys</a></p>
        </div>

        {/* Dropzone */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <label style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10, display: "block" }}>Resume PDF</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? C.accent : file ? C.accentMid : C.border}`, borderRadius: 10, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: dragging ? C.accentDim : "transparent", transition: "all 0.2s" }}>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <><div style={{ fontSize: 26, marginBottom: 6 }}>📄</div>
                <div style={{ color: C.accent, fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · Click to change</div></>
            ) : (
              <><div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                <div style={{ color: C.text, fontSize: 14 }}>Drop PDF here or click to browse</div></>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {loading && <div style={{ height: 3, background: `linear-gradient(90deg,${C.accent} ${progress}%,${C.border} ${progress}%)`, borderRadius: 2, marginBottom: 14, transition: "background 0.3s" }} />}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={!file || !apiKey || loading}
          style={{ width: "100%", padding: "13px 24px", background: (!file || !apiKey || loading) ? C.border : C.accent, color: (!file || !apiKey || loading) ? C.muted : C.bg, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", cursor: (!file || !apiKey || loading) ? "not-allowed" : "pointer", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", transition: "all 0.2s" }}>
          {loading ? <><span style={{ display: "inline-block", width: 13, height: 13, border: `2px solid ${C.muted}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 8, verticalAlign: "middle" }} />Evaluating...</> : "▶  Run Evaluation"}
        </button>

        {/* Logs */}
        {logs.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginTop: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>Pipeline Log</div>
            <div style={{ background: C.bg, borderRadius: 8, padding: 14, fontSize: 12, color: C.muted, maxHeight: 160, overflowY: "auto", lineHeight: 1.8 }}>
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div style={{ marginTop: 14, padding: "12px 16px", background: "#ff6b6b15", border: `1px solid ${C.warn}40`, borderRadius: 8, color: C.warn, fontSize: 13 }}>{error}</div>}

        {/* Results */}
        {result && (
          <div style={{ marginTop: 32, animation: "fadeUp 0.6s ease" }}>
            {/* Total */}
            <div style={{ background: `linear-gradient(135deg,${C.surface},${C.bg})`, border: `1px solid ${C.accentMid}`, borderRadius: 16, padding: 28, textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Overall Score — {result.candidate_name}</div>
              <div style={{ fontSize: 62, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: result.total_score >= 70 ? C.accent : result.total_score >= 50 ? C.gold : C.warn, lineHeight: 1 }}>{result.total_score}</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>out of {result.max_score}</div>
              <Badge value={result.hire_recommendation} />
              {result.summary && <p style={{ marginTop: 14, fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 500, margin: "14px auto 0" }}>{result.summary}</p>}
            </div>

            {/* Category scores */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {[["open_source","🌐","Open Source"],["self_projects","🚀","Self Projects"],["production","🏢","Production"],["technical_skills","💻","Tech Skills"]].map(([key, icon, label]) => {
                const cat = result.scores[key]; if (!cat) return null;
                return (
                  <div key={key} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 6 }}>{cat.evidence}</div>
                    <ScoreBar score={cat.score} max={cat.max} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, width: `${Math.min((cat.score/cat.max)*100,100)}%`, background: (cat.score/cat.max)>0.7?C.accent:(cat.score/cat.max)>0.4?C.gold:C.warn, transition: "width 1s ease" }} />
                  </div>
                );
              })}
            </div>

            {/* Bonus / Deductions */}
            {(result.bonus_points?.total > 0 || result.deductions?.total > 0) && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, display: "flex", gap: 20, marginBottom: 14 }}>
                {result.bonus_points?.total > 0 && <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>⭐ Bonus +{result.bonus_points.total}</div><div style={{ fontSize: 13, color: C.accent }}>{result.bonus_points.breakdown}</div></div>}
                {result.deductions?.total > 0 && <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>⚠️ Deductions −{result.deductions.total}</div><div style={{ fontSize: 13, color: C.warn }}>{result.deductions.reasons}</div></div>}
              </div>
            )}

            {/* Strengths / Improvements */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.accent, marginBottom: 10 }}>✅ Key Strengths</div>
                {result.key_strengths?.map((s, i) => <div key={i} style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentMid}`, marginBottom: 6, marginRight: 6 }}>{s}</div>)}
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: 10 }}>🔧 Improve</div>
                {result.areas_for_improvement?.map((a, i) => <div key={i} style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "#ffd16615", color: C.gold, border: `1px solid ${C.gold}40`, marginBottom: 6, marginRight: 6 }}>{a}</div>)}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
