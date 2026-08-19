import React, { useState, useEffect } from "react";
import { Trash2, ExternalLink, PlusCircle, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// 1. TypeScript typy kopírující relační strukturu z backendu
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

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const API_URL = "http://localhost:5000/api/products";

  // Načtení všech produktů z backendu
  const loadProducts = async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Chyba při načítání dat");
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Odeslání URL ke stažení dat a sledování
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });

      const data = await res.json();

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

  // Smazání produktu ze sledování
  const handleDelete = async (id: number) => {
    try {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      setProducts(products.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Chyba při mazání:", err);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <span className="eyebrow">Sledování cen</span>
        <h1>Dashboard</h1>
        <p className="subtitle">Automatické sledování vývoje cen v čase</p>
      </header>

      {/* Formulář */}
      <section className="card">
        <h2>Sledovat nový produkt</h2>
        <form onSubmit={handleAddUrl} className="form-row">
          <input
            type="url"
            placeholder="Vložte URL adresu produktu (např. https://www.alza.cz/...)"
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

        {errorMsg && <p className="error-message">⚠ {errorMsg}</p>}
      </section>

      {/* Seznam karet produktů s grafy */}
      <div className="products-grid">
        {products.length === 0 ? (
          <div className="card empty-state">
            Zatím nesledujete žádné produkty. Zadejte URL adresu výše.
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
                    <div className="meta-text">
                      Sledováno od:{" "}
                      {new Date(product.createdAt).toLocaleDateString("cs-CZ")}
                    </div>
                  </div>

                  <div className="product-actions">
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
