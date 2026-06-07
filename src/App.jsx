import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : undefined,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.status === 204 ? null : res.json();
}

// ─── INITIAL MATERIALS ────────────────────────────────────────────────────────
const INITIAL_MATERIALS = [
  "Catalog EN",
  "Catalog DE",
  "Flyers",
  "Rollups",
  "Giveaways",
];

// ─── ADMIN CREDENTIALS (change these!) ───────────────────────────────────────
const ADMIN_USER = "admin";
const ADMIN_PASS = "marketing2024";

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg: "var(--color-background-primary)",
  bg2: "var(--color-background-secondary)",
  bg3: "var(--color-background-tertiary)",
  border: "var(--color-border-tertiary)",
  border2: "var(--color-border-secondary)",
  text: "var(--color-text-primary)",
  text2: "var(--color-text-secondary)",
  text3: "var(--color-text-tertiary)",
  info: "var(--color-background-info)",
  infoText: "var(--color-text-info)",
  success: "var(--color-background-success)",
  successText: "var(--color-text-success)",
  danger: "var(--color-background-danger)",
  dangerText: "var(--color-text-danger)",
  warning: "var(--color-background-warning)",
  warningText: "var(--color-text-warning)",
};

// ─── SETUP SQL (shown to user) ────────────────────────────────────────────────
const SETUP_SQL = `-- Run this in Supabase SQL Editor

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  total_stock integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id) on delete cascade,
  type text not null check (type in ('add','send','return')),
  quantity integer not null,
  exhibition text,
  note text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Enable Row Level Security (open read/write for now — tighten later)
alter table materials enable row level security;
alter table transactions enable row level security;

create policy "allow all" on materials for all using (true) with check (true);
create policy "allow all" on transactions for all using (true) with check (true);

-- Seed initial materials
insert into materials (name, total_stock) values
  ('Catalog EN', 0),
  ('Catalog DE', 0),
  ('Flyers', 0),
  ('Rollups', 0),
  ('Giveaways', 0)
on conflict (name) do nothing;`;

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Badge({ children, color = "info" }) {
  return (
    <span style={{
      background: C[color],
      color: C[`${color}Text`],
      fontSize: 11,
      fontWeight: 500,
      padding: "2px 8px",
      borderRadius: "var(--border-radius-md)",
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: C.bg2,
      borderRadius: "var(--border-radius-md)",
      padding: "0.75rem 1rem",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: C.text2, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 13, color: C.text2, fontWeight: 500 }}>{label}</label>}
      <input {...props} style={{ width: "100%", boxSizing: "border-box" }} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 13, color: C.text2, fontWeight: 500 }}>{label}</label>}
      <select {...props} style={{ width: "100%", boxSizing: "border-box" }}>
        {children}
      </select>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.bg,
        border: `0.5px solid ${C.border2}`,
        borderRadius: "var(--border-radius-lg)",
        padding: "1.5rem",
        width: "100%",
        maxWidth: 420,
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.text2, fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 2000,
      background: type === "success" ? C.success : C.danger,
      color: type === "success" ? C.successText : C.dangerText,
      padding: "0.75rem 1.25rem",
      borderRadius: "var(--border-radius-md)",
      fontSize: 14, fontWeight: 500,
      border: `0.5px solid ${type === "success" ? "var(--color-border-success)" : "var(--color-border-danger)"}`,
      maxWidth: 320,
    }}>
      {message}
    </div>
  );
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function SetupScreen({ onSave }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [showSql, setShowSql] = useState(false);
  return (
    <div style={{ maxWidth: 560, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{
        background: C.bg,
        border: `0.5px solid ${C.border2}`,
        borderRadius: "var(--border-radius-lg)",
        padding: "2rem",
      }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: 18 }}>Connect to Supabase</h2>
        <p style={{ fontSize: 14, color: C.text2, margin: "0 0 1.5rem" }}>
          First time setup. Enter your Supabase project credentials below.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <Input label="Project URL" placeholder="https://xxxx.supabase.co" value={url} onChange={e => setUrl(e.target.value)} />
          <Input label="Anon Key" placeholder="eyJ..." value={key} onChange={e => setKey(e.target.value)} type="password" />
        </div>

        <button
          onClick={() => url && key && onSave(url.trim(), key.trim())}
          disabled={!url || !key}
          style={{ width: "100%", padding: "0.6rem", marginBottom: "1rem", fontWeight: 500 }}
        >
          Connect
        </button>

        <button
          onClick={() => setShowSql(!showSql)}
          style={{ width: "100%", padding: "0.6rem", background: "none" }}
        >
          {showSql ? "Hide" : "Show"} database setup SQL ↗
        </button>

        {showSql && (
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>
              Run this SQL in your Supabase project → SQL Editor:
            </p>
            <textarea
              readOnly
              value={SETUP_SQL}
              style={{ width: "100%", height: 200, fontSize: 11, fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
            />
          </div>
        )}

        <div style={{
          marginTop: "1.5rem",
          background: C.bg2,
          borderRadius: "var(--border-radius-md)",
          padding: "1rem",
          fontSize: 13,
          color: C.text2,
        }}>
          <strong style={{ color: C.text }}>How to get these values:</strong>
          <ol style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", lineHeight: 2 }}>
            <li>Go to <strong>supabase.com</strong> → your project</li>
            <li>Settings → API</li>
            <li>Copy <em>Project URL</em> and <em>anon public</em> key</li>
            <li>Paste above and click Connect</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);

  function handleLogin() {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      onLogin("admin");
    } else if (user && pass) {
      onLogin("user");
    } else {
      setErr(true);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "3rem auto", padding: "0 1rem" }}>
      <div style={{
        background: C.bg,
        border: `0.5px solid ${C.border2}`,
        borderRadius: "var(--border-radius-lg)",
        padding: "2rem",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Inventory Tracker</h2>
          <p style={{ fontSize: 13, color: C.text2, margin: "0.25rem 0 0" }}>Marketing materials management</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Input label="Username" value={user} onChange={e => { setUser(e.target.value); setErr(false); }} />
          <Input label="Password" type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(false); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
          {err && <p style={{ fontSize: 13, color: C.dangerText, margin: 0 }}>Please enter username and password.</p>}
          <button onClick={handleLogin} style={{ padding: "0.6rem", fontWeight: 500, marginTop: 4 }}>
            Sign in
          </button>
        </div>
        <p style={{ fontSize: 11, color: C.text3, textAlign: "center", marginTop: "1rem", marginBottom: 0 }}>
          Admin: {ADMIN_USER} / {ADMIN_PASS}
        </p>
      </div>
    </div>
  );
}

// ─── TRANSACTION FORM MODAL ───────────────────────────────────────────────────
function TransactionModal({ materials, onClose, onSubmit, defaultMaterial }) {
  const [type, setType] = useState("add");
  const [materialId, setMaterialId] = useState(defaultMaterial || materials[0]?.id || "");
  const [qty, setQty] = useState("");
  const [exhibition, setExhibition] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!materialId || !qty || qty < 1) return;
    if ((type === "send" || type === "return") && !exhibition) return;
    setLoading(true);
    await onSubmit({ type, material_id: materialId, quantity: parseInt(qty), exhibition, note, date });
    setLoading(false);
    onClose();
  }

  const labels = { add: "Add stock", send: "Send to exhibition", return: "Return from exhibition" };

  return (
    <Modal title="Record transaction" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Select label="Type" value={type} onChange={e => setType(e.target.value)}>
          <option value="add">Add stock</option>
          <option value="send">Send to exhibition</option>
          <option value="return">Return from exhibition</option>
        </Select>

        <Select label="Material" value={materialId} onChange={e => setMaterialId(e.target.value)}>
          {materials.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>

        <Input label="Quantity" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />

        {(type === "send" || type === "return") && (
          <Input label="Exhibition name" value={exhibition} onChange={e => setExhibition(e.target.value)}
            placeholder="e.g. BIEMH Spain 2025" />
        )}

        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} placeholder="Any additional notes" />

        <button onClick={handleSubmit} disabled={loading} style={{ padding: "0.6rem", fontWeight: 500, marginTop: 4 }}>
          {loading ? "Saving…" : labels[type]}
        </button>
      </div>
    </Modal>
  );
}

// ─── ADD MATERIAL MODAL ───────────────────────────────────────────────────────
function AddMaterialModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit() {
    if (!name.trim()) return;
    setLoading(true);
    await onSubmit(name.trim());
    setLoading(false);
    onClose();
  }
  return (
    <Modal title="Add new material" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Input label="Material name" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Brochures" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        <button onClick={handleSubmit} disabled={loading} style={{ padding: "0.6rem", fontWeight: 500 }}>
          {loading ? "Adding…" : "Add material"}
        </button>
      </div>
    </Modal>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab({ materials, transactions, onTransaction, isAdmin }) {
  const totalItems = materials.reduce((s, m) => s + m.total_stock, 0);
  const outItems = materials.reduce((s, m) => {
    const sent = transactions.filter(t => t.material_id === m.id && t.type === "send").reduce((a, t) => a + t.quantity, 0);
    const ret = transactions.filter(t => t.material_id === m.id && t.type === "return").reduce((a, t) => a + t.quantity, 0);
    return s + Math.max(0, sent - ret);
  }, 0);

  const exhibitions = [...new Set(transactions.filter(t => t.exhibition).map(t => t.exhibition))];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
        <MetricCard label="Total stock" value={totalItems} sub="units in warehouse" />
        <MetricCard label="Currently out" value={outItems} sub="at exhibitions" color="#BA7517" />
        <MetricCard label="Materials" value={materials.length} sub="types tracked" />
        <MetricCard label="Exhibitions" value={exhibitions.length} sub="total destinations" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Stock overview</h3>
        <button onClick={() => onTransaction()} style={{ padding: "0.4rem 0.75rem", fontSize: 13 }}>
          + Record transaction
        </button>
      </div>

      <div style={{
        border: `0.5px solid ${C.border}`,
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: C.bg2 }}>
              {["Material", "In stock", "Out", "Available", "Actions"].map(h => (
                <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 500, fontSize: 12, color: C.text2, borderBottom: `0.5px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materials.map((m, i) => {
              const sent = transactions.filter(t => t.material_id === m.id && t.type === "send").reduce((a, t) => a + t.quantity, 0);
              const ret = transactions.filter(t => t.material_id === m.id && t.type === "return").reduce((a, t) => a + t.quantity, 0);
              const out = Math.max(0, sent - ret);
              const available = m.total_stock - out;
              return (
                <tr key={m.id} style={{ borderBottom: i < materials.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>{m.total_stock}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {out > 0 ? <Badge color="warning">{out}</Badge> : <span style={{ color: C.text3 }}>—</span>}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <Badge color={available > 5 ? "success" : available > 0 ? "warning" : "danger"}>{available}</Badge>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <button onClick={() => onTransaction(m.id)} style={{ fontSize: 12, padding: "0.2rem 0.5rem" }}>+</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TRANSACTIONS TAB ─────────────────────────────────────────────────────────
function TransactionsTab({ materials, transactions, searchMaterial, searchExhibition }) {
  const [filterMaterial, setFilterMaterial] = useState(searchMaterial || "");
  const [filterExhibition, setFilterExhibition] = useState(searchExhibition || "");
  const [filterType, setFilterType] = useState("");

  useEffect(() => { if (searchMaterial) setFilterMaterial(searchMaterial); }, [searchMaterial]);
  useEffect(() => { if (searchExhibition) setFilterExhibition(searchExhibition); }, [searchExhibition]);

  const getMaterialName = (id) => materials.find(m => m.id === id)?.name || "Unknown";
  const exhibitions = [...new Set(transactions.filter(t => t.exhibition).map(t => t.exhibition))];

  const filtered = transactions.filter(t => {
    if (filterMaterial && t.material_id !== filterMaterial) return false;
    if (filterExhibition && t.exhibition !== filterExhibition) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  });

  const typeLabel = { add: "Stock added", send: "Sent out", return: "Returned" };
  const typeColor = { add: "success", send: "warning", return: "info" };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: "1rem" }}>
        <Select value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
          <option value="">All materials</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select value={filterExhibition} onChange={e => setFilterExhibition(e.target.value)}>
          <option value="">All exhibitions</option>
          {exhibitions.map(e => <option key={e} value={e}>{e}</option>)}
        </Select>
        <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All types</option>
          <option value="add">Stock added</option>
          <option value="send">Sent out</option>
          <option value="return">Returned</option>
        </Select>
      </div>

      <div style={{ fontSize: 13, color: C.text2, marginBottom: "0.5rem" }}>
        {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
      </div>

      <div style={{ border: `0.5px solid ${C.border}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg2 }}>
              {["Date", "Material", "Type", "Qty", "Exhibition", "Note"].map(h => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 500, fontSize: 12, color: C.text2, borderBottom: `0.5px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: C.text3 }}>No transactions found</td></tr>
            ) : filtered.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                <td style={{ padding: "0.5rem 0.75rem", color: C.text2 }}>{t.date}</td>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{getMaterialName(t.material_id)}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}><Badge color={typeColor[t.type]}>{typeLabel[t.type]}</Badge></td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{t.quantity}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: C.text2 }}>{t.exhibition || "—"}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: C.text3 }}>{t.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SEARCH TAB ───────────────────────────────────────────────────────────────
function SearchTab({ materials, transactions, onNavigate }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("material");

  const exhibitions = [...new Set(transactions.filter(t => t.exhibition).map(t => t.exhibition))];
  const getMaterialName = (id) => materials.find(m => m.id === id)?.name || "Unknown";

  const results = mode === "material"
    ? materials.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    : exhibitions.filter(e => e.toLowerCase().includes(query.toLowerCase()));

  function goToExhibition(ex) {
    onNavigate("transactions", { exhibition: ex });
  }

  function goToMaterial(id) {
    onNavigate("transactions", { material: id });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        <button onClick={() => setMode("material")} style={{ padding: "0.4rem 0.75rem", fontSize: 13, fontWeight: mode === "material" ? 500 : 400, background: mode === "material" ? C.info : "none", color: mode === "material" ? C.infoText : C.text }}>
          By material
        </button>
        <button onClick={() => setMode("exhibition")} style={{ padding: "0.4rem 0.75rem", fontSize: 13, fontWeight: mode === "exhibition" ? 500 : 400, background: mode === "exhibition" ? C.info : "none", color: mode === "exhibition" ? C.infoText : C.text }}>
          By exhibition
        </button>
      </div>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={mode === "material" ? "Search materials…" : "Search exhibitions…"}
        style={{ width: "100%", boxSizing: "border-box", marginBottom: "1rem" }}
      />

      {mode === "material" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map(m => {
            const sent = transactions.filter(t => t.material_id === m.id && t.type === "send").reduce((a, t) => a + t.quantity, 0);
            const ret = transactions.filter(t => t.material_id === m.id && t.type === "return").reduce((a, t) => a + t.quantity, 0);
            const out = Math.max(0, sent - ret);
            return (
              <div key={m.id} style={{
                background: C.bg,
                border: `0.5px solid ${C.border}`,
                borderRadius: "var(--border-radius-md)",
                padding: "0.75rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
                    {m.total_stock} total · {out} out · {m.total_stock - out} available
                  </div>
                </div>
                <button onClick={() => goToMaterial(m.id)} style={{ fontSize: 12, padding: "0.25rem 0.6rem" }}>
                  View history
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.length === 0 && <div style={{ color: C.text3, fontSize: 14 }}>No exhibitions found.</div>}
          {results.map(ex => {
            const exTx = transactions.filter(t => t.exhibition === ex);
            const sent = exTx.filter(t => t.type === "send").reduce((a, t) => a + t.quantity, 0);
            const ret = exTx.filter(t => t.type === "return").reduce((a, t) => a + t.quantity, 0);
            return (
              <div key={ex} style={{
                background: C.bg,
                border: `0.5px solid ${C.border}`,
                borderRadius: "var(--border-radius-md)",
                padding: "0.75rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{ex}</div>
                  <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
                    {sent} sent · {ret} returned · {sent - ret} still out
                  </div>
                </div>
                <button onClick={() => goToExhibition(ex)} style={{ fontSize: 12, padding: "0.25rem 0.6rem" }}>
                  View all
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN TAB ────────────────────────────────────────────────────────────────
function AdminTab({ materials, transactions, onAddMaterial }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Material management</h3>
        <button onClick={onAddMaterial} style={{ padding: "0.4rem 0.75rem", fontSize: 13 }}>
          + Add material
        </button>
      </div>

      <div style={{ border: `0.5px solid ${C.border}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg2 }}>
              {["Material", "Total stock", "Transactions", "Created"].map(h => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 500, fontSize: 12, color: C.text2, borderBottom: `0.5px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materials.map((m, i) => (
              <tr key={m.id} style={{ borderBottom: i < materials.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{m.name}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{m.total_stock}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{transactions.filter(t => t.material_id === m.id).length}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: C.text2 }}>{new Date(m.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 15, marginBottom: "0.75rem" }}>All recent activity</h3>
      <div style={{ border: `0.5px solid ${C.border}`, borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg2 }}>
              {["Time", "Material", "Type", "Qty", "Exhibition"].map(h => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 500, fontSize: 12, color: C.text2, borderBottom: `0.5px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 30).map((t, i) => (
              <tr key={t.id} style={{ borderBottom: i < Math.min(transactions.length, 30) - 1 ? `0.5px solid ${C.border}` : "none" }}>
                <td style={{ padding: "0.5rem 0.75rem", color: C.text2 }}>{new Date(t.created_at).toLocaleString()}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{materials.find(m => m.id === t.material_id)?.name || "?"}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}><Badge color={t.type === "add" ? "success" : t.type === "send" ? "warning" : "info"}>{t.type}</Badge></td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{t.quantity}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: C.text2 }}>{t.exhibition || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Config state
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem("inv_url") || "");
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem("inv_key") || "");
  const isConfigured = supabaseUrl && supabaseKey;

  // Auth state
  const [role, setRole] = useState(null); // null | "user" | "admin"

  // Data state
  const [materials, setMaterials] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [tab, setTab] = useState("dashboard");
  const [txModal, setTxModal] = useState(false);
  const [txDefaultMaterial, setTxDefaultMaterial] = useState(null);
  const [addMaterialModal, setAddMaterialModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [navParams, setNavParams] = useState({});

  // Override Supabase config with current credentials
  const api = useCallback((method, path, body) => {
    const url = supabaseUrl || SUPABASE_URL;
    const key = supabaseKey || SUPABASE_ANON_KEY;
    return fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(method === "POST" ? { Prefer: "return=representation" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async r => {
      if (!r.ok) throw new Error(await r.text());
      return r.status === 204 ? null : r.json();
    });
  }, [supabaseUrl, supabaseKey]);

  async function loadData() {
    setLoading(true);
    try {
      const [mats, txs] = await Promise.all([
        api("GET", "materials?order=name"),
        api("GET", "transactions?order=created_at.desc"),
      ]);
      setMaterials(mats || []);
      setTransactions(txs || []);
    } catch (e) {
      setToast({ message: "Failed to load data: " + e.message, type: "error" });
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isConfigured && role) loadData();
  }, [isConfigured, role]);

  function handleSaveConfig(url, key) {
    localStorage.setItem("inv_url", url);
    localStorage.setItem("inv_key", key);
    setSupabaseUrl(url);
    setSupabaseKey(key);
  }

  async function handleTransaction({ type, material_id, quantity, exhibition, note, date }) {
    try {
      // Compute new stock
      const mat = materials.find(m => m.id === material_id);
      let newStock = mat.total_stock;
      if (type === "add") newStock += quantity;
      else if (type === "send") newStock -= 0; // stock unchanged, tracked by transactions
      else if (type === "return") newStock += 0;

      // For add, update total_stock
      if (type === "add") {
        await api("PATCH", `materials?id=eq.${material_id}`, { total_stock: mat.total_stock + quantity });
      }

      await api("POST", "transactions", { material_id, type, quantity, exhibition: exhibition || null, note: note || null, date });
      setToast({ message: "Transaction recorded!", type: "success" });
      loadData();
    } catch (e) {
      setToast({ message: "Error: " + e.message, type: "error" });
    }
  }

  async function handleAddMaterial(name) {
    try {
      await api("POST", "materials", { name, total_stock: 0 });
      setToast({ message: `"${name}" added!`, type: "success" });
      loadData();
    } catch (e) {
      setToast({ message: "Error: " + e.message, type: "error" });
    }
  }

  function handleNavigate(newTab, params = {}) {
    setTab(newTab);
    setNavParams(params);
  }

  if (!isConfigured) return <SetupScreen onSave={handleSaveConfig} />;
  if (!role) return <LoginScreen onLogin={setRole} />;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
    { id: "transactions", label: "Transactions", icon: "ti-list" },
    { id: "search", label: "Search", icon: "ti-search" },
    ...(role === "admin" ? [{ id: "admin", label: "Admin", icon: "ti-settings" }] : []),
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>📦 Inventory Tracker</h1>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>Marketing materials</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {role === "admin" && <Badge color="warning">Admin</Badge>}
          <button onClick={() => setTxModal(true)} style={{ padding: "0.4rem 0.75rem", fontSize: 13 }}>
            + Transaction
          </button>
          <button onClick={() => { setRole(null); }} style={{ padding: "0.4rem 0.75rem", fontSize: 13, background: "none", color: C.text2 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `0.5px solid ${C.border}`, marginBottom: "1.25rem" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setNavParams({}); }} style={{
            padding: "0.5rem 0.75rem",
            fontSize: 13,
            fontWeight: tab === t.id ? 500 : 400,
            background: "none",
            border: "none",
            borderBottom: tab === t.id ? `2px solid ${C.infoText}` : "2px solid transparent",
            borderRadius: 0,
            color: tab === t.id ? C.infoText : C.text2,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -1,
          }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && <div style={{ textAlign: "center", padding: "2rem", color: C.text2, fontSize: 14 }}>Loading…</div>}

      {!loading && tab === "dashboard" && (
        <DashboardTab
          materials={materials}
          transactions={transactions}
          onTransaction={(id) => { setTxDefaultMaterial(id || null); setTxModal(true); }}
          isAdmin={role === "admin"}
        />
      )}
      {!loading && tab === "transactions" && (
        <TransactionsTab
          materials={materials}
          transactions={transactions}
          searchMaterial={navParams.material}
          searchExhibition={navParams.exhibition}
        />
      )}
      {!loading && tab === "search" && (
        <SearchTab
          materials={materials}
          transactions={transactions}
          onNavigate={handleNavigate}
        />
      )}
      {!loading && tab === "admin" && role === "admin" && (
        <AdminTab
          materials={materials}
          transactions={transactions}
          onAddMaterial={() => setAddMaterialModal(true)}
        />
      )}

      {/* Modals */}
      {txModal && (
        <TransactionModal
          materials={materials}
          defaultMaterial={txDefaultMaterial}
          onClose={() => setTxModal(false)}
          onSubmit={handleTransaction}
        />
      )}
      {addMaterialModal && (
        <AddMaterialModal
          onClose={() => setAddMaterialModal(false)}
          onSubmit={handleAddMaterial}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
