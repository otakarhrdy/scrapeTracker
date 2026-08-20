import React, { useState, useEffect } from "react";
import {
  Trash2,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  LogOut,
  UserCheck,
  ShieldCheck,
  Copy,
  Check,
  Ghost,
  ScanEye,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface User {
  id: number;
  username: string;
}

interface PricePoint {
  id: number;
  price: number;
  timestamp: string;
}

interface Product {
  id: number;
  url: string;
  title: string;
  currentPrice: number;
  createdAt: string;
  priceHistory: PricePoint[];
}

const parseJsonResponse = async <T,>(res: Response): Promise<T> => {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();

    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        "API server vrátil HTML místo JSON. Zkontrolujte VITE_API_URL nebo adresu produkčního backendu.",
      );
    }

    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return (await res.json()) as T;
};

const generateRandomCredentials = () => {
  const adjectives = [
    "silent",
    "swift",
    "cyber",
    "shadow",
    "neon",
    "brave",
    "cosmic",
    "iron",
  ];
  const nouns = [
    "tiger",
    "falcon",
    "runner",
    "wolf",
    "phantom",
    "coder",
    "seeker",
    "scout",
  ];
  const randomNum = Math.floor(100 + Math.random() * 900);

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomUsername = `${adj}-${noun}-${randomNum}`;

  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
  let randomPassword = "";
  for (let i = 0; i < 12; i++) {
    randomPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return { randomUsername, randomPassword };
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("price_tracker_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const API_URL =
    (import.meta.env.VITE_API_URL
      ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, "")
      : window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : window.location.origin) + "/api";

  const loadProducts = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_URL}/products`, {
        headers: { "x-user-id": String(currentUser.id) },
      });
      if (res.ok) {
        const data = await parseJsonResponse<Product[]>(res);
        setProducts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadProducts();

      const refreshTimer = window.setInterval(loadProducts, 60 * 60 * 1000);
      return () => window.clearInterval(refreshTimer);
    }
  }, [currentUser]);

  const handleGenerateRandom = () => {
    const { randomUsername, randomPassword } = generateRandomCredentials();
    setAuthUsername(randomUsername);
    setAuthPassword(randomPassword);
    setShowPassword(true); // Při vygenerování rovnou odkryjeme, ať to vidí
    setAuthMode("register");
    setAuthError("");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;

    setAuthError("");
    setAuthLoading(true);

    const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });

      const data = await parseJsonResponse<User & { error?: string }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Autentizace selhala");
      }

      localStorage.setItem("price_tracker_user", JSON.stringify(data));
      setCurrentUser(data);
      setAuthUsername("");
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("price_tracker_user");
    setCurrentUser(null);
    setProducts([]);
  };

  const handleCopyPassword = () => {
    if (!authPassword) return;
    navigator.clipboard.writeText(authPassword);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !currentUser) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(currentUser.id),
        },
        body: JSON.stringify({ url: inputUrl }),
      });

      const data = await parseJsonResponse<{ error?: string }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Scraping selhal");
      }

      setInputUrl("");
      loadProducts();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!currentUser) return;
    try {
      await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
        headers: { "x-user-id": String(currentUser.id) },
      });
      setProducts(products.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // 1. ZOBRAZENÍ PRO NEPŘIHLÁŠENÉHO UŽIVATELE (Auth Box)
  if (!currentUser) {
    return (
      <div
        className="container"
        style={{ maxWidth: "520px", marginTop: "3rem" }}
      >
        <header className="header">
          <h1>Price Tracker</h1>
          <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
            Anonymní a bezpečné sledování cen bez osobních údajů
          </p>
        </header>

        <div className="card">
          <div
            style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}
          >
            <button
              onClick={() => setAuthMode("register")}
              className="btn-primary"
              style={{
                flex: 1,
                justifyContent: "center",
                backgroundColor:
                  authMode === "register"
                    ? "rgba(34, 211, 238, 0.16)"
                    : "rgba(148, 163, 184, 0.08)",
                borderColor:
                  authMode === "register"
                    ? "rgba(34, 211, 238, 0.4)"
                    : "rgba(148, 163, 184, 0.18)",
                color: authMode === "register" ? "#dffcff" : "#dfe7f4",
                boxShadow:
                  authMode === "register"
                    ? "0 8px 18px rgba(34, 211, 238, 0.08)"
                    : "none",
              }}
            >
              Nová registrace
            </button>
            <button
              onClick={() => setAuthMode("login")}
              className="btn-primary"
              style={{
                flex: 1,
                justifyContent: "center",
                backgroundColor:
                  authMode === "login"
                    ? "rgba(34, 211, 238, 0.16)"
                    : "rgba(148, 163, 184, 0.08)",
                borderColor:
                  authMode === "login"
                    ? "rgba(34, 211, 238, 0.4)"
                    : "rgba(148, 163, 184, 0.18)",
                color: authMode === "login" ? "#dffcff" : "#dfe7f4",
                boxShadow:
                  authMode === "login"
                    ? "0 8px 18px rgba(34, 211, 238, 0.08)"
                    : "none",
              }}
            >
              Přihlásit se
            </button>
          </div>

          {authMode === "register" && (
            <button
              type="button"
              onClick={handleGenerateRandom}
              className="btn-primary"
              style={{
                width: "100%",
                marginBottom: "1.25rem",
                justifyContent: "center",
                background: "rgba(139, 92, 246, 0.12)",
                borderColor: "rgba(139, 92, 246, 0.38)",
                color: "#ede9fe",
                boxShadow: "0 8px 20px rgba(139, 92, 246, 0.1)",
              }}
            >
              Vygenerovat náhodnou identitu
            </button>
          )}

          <form
            onSubmit={handleAuthSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "0.3rem",
                }}
              >
                Uživatelské jméno / Pseudonym:
              </label>
              <input
                type="text"
                autoComplete="username"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="např. cyber-runner-404"
                required
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.3rem",
                }}
              >
                <label style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                  Heslo:
                </label>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: showPassword ? "#38bdf8" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {showPassword ? "mrk mrk" : "Psssssssssst"}
                </span>
              </div>

              {/* Stylový kontejner pro heslo s interaktivním špionážním tlačítkem */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    authMode === "register"
                      ? "new-password"
                      : "current-password"
                  }
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Zadejte nebo vygenerujte"
                  required
                  style={{
                    width: "100%",
                    paddingRight: "5.5rem",
                    borderColor: showPassword ? "#38bdf8" : "#334155",
                    transition: "border-color 0.2s",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    right: "0.5rem",
                    display: "flex",
                    gap: "0.25rem",
                  }}
                >
                  {authPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      style={{
                        background: "#334155",
                        border: "none",
                        color: copiedPass ? "#22c55e" : "#cbd5e1",
                        borderRadius: "6px",
                        padding: "0.35rem 0.5rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Kopírovat heslo"
                    >
                      {copiedPass ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: showPassword
                        ? "rgba(56, 189, 248, 0.2)"
                        : "#334155",
                      border: "none",
                      color: showPassword ? "#38bdf8" : "#94a3b8",
                      borderRadius: "6px",
                      padding: "0.35rem 0.55rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      transition: "all 0.2s",
                    }}
                    title={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
                  >
                    {showPassword ? <ScanEye size={15} /> : <Ghost size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {authError && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>
                ⚠ {authError}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={authLoading}
              style={{
                justifyContent: "center",
                marginTop: "0.5rem",
                padding: "0.85rem",
                opacity: authLoading ? 0.7 : 1,
                cursor: authLoading ? "wait" : "pointer",
              }}
            >
              {authLoading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <ShieldCheck size={18} />
              )}{" "}
              {authLoading
                ? "Čekám na server..."
                : authMode === "register"
                  ? "Vytvořit anonymní profil"
                  : "Vstoupit do dashboardu"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. ZOBRAZENÍ PRO PŘIHLÁŠENÉHO UŽIVATELE (Dashboard)
  return (
    <div className="container">
      {/* Horní lišta s přihlášeným uživatelem */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.95rem",
          }}
        >
          <UserCheck size={18} color="#22c55e" />
          <span>
            Přihlášen jako: <strong>{currentUser.username}</strong>
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="btn-delete"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            color: "#94a3b8",
          }}
          title="Odhlásit se"
        >
          <LogOut size={16} /> Odhlásit
        </button>
      </div>

      <header className="header">
        <h1>Price & Web Scraper Dashboard</h1>
        <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
          Automatické sledování vývoje cen v čase
        </p>
      </header>

      {/* Formulář pro novou URL */}
      <section className="card">
        <h2>Sledovat nový produkt</h2>
        <form onSubmit={handleAddUrl} className="form-row">
          <input
            type="url"
            placeholder="Vložte URL adresu produktu"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Scrapuji...
              </>
            ) : (
              <>
                <PlusCircle size={16} /> Přidat ke sledování
              </>
            )}
          </button>
        </form>

        {errorMsg && (
          <p
            style={{
              color: "#ef4444",
              marginTop: "0.75rem",
              fontSize: "0.9rem",
            }}
          >
            ⚠ {errorMsg}
          </p>
        )}
      </section>

      {/* Seznam produktů s grafy */}
      <div className="products-grid">
        {products.length === 0 ? (
          <div
            className="card"
            style={{ textAlign: "center", color: "#64748b" }}
          >
            Ve svém účtu zatím nesledujete žádné produkty. Vložte odkaz výše.
          </div>
        ) : (
          products.map((product) => {
            const chartData = product.priceHistory.map((point) => ({
              time: new Date(point.timestamp).toLocaleDateString("cs-CZ", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }),
              price: point.price,
            }));

            return (
              <div key={product.id} className="card">
                <div className="product-header">
                  <div>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="product-title"
                    >
                      {product.title}{" "}
                      <ExternalLink size={14} style={{ display: "inline" }} />
                    </a>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "0.8rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      Sledováno od:{" "}
                      {new Date(product.createdAt).toLocaleDateString("cs-CZ")}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <div className="price-tag">
                      {product.currentPrice.toLocaleString("cs-CZ")} Kč
                    </div>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="btn-delete"
                      title="Smazat sledování"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        domain={["auto", "auto"]}
                        tickFormatter={(val) => `${val} Kč`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                        }}
                        formatter={(val) => [
                          `${Number(val).toLocaleString("cs-CZ")} Kč`,
                          "Cena",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#38bdf8" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
