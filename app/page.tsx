"use client";

import { useEffect, useMemo, useState } from "react";

type Recipe = {
  title: string;
  servings: number;
  time_minutes: number;
  ingredients_used: string[];
  pantry_items_needed: string[];
  instructions: string[];
  tips: string[];
  warnings: string[];
};

type SavedRecipe = {
  id: string;
  savedAt: number;
  isFavorite: boolean;
  inputs: {
    ingredients: string;
    preferences: string;
    exclude: string;
    servings: number;
    maxTime: number;
  };
  recipe: Recipe;
};

const STORAGE_KEY = "fridge_recipes_history_v1";
const MAX_HISTORY = 10;

const EXAMPLES = [
  "eggs, spinach, feta, tortillas",
  "chicken, rice, broccoli, soy sauce",
  "pasta, tomatoes, garlic, olive oil",
  "tuna, mayonnaise, bread, cucumber",
];

export default function Home() {
  const [ingredients, setIngredients] = useState("");
  const [preferences, setPreferences] = useState("");
  const [exclude, setExclude] = useState("");
  const [servings, setServings] = useState<number>(2);
  const [maxTime, setMaxTime] = useState<number>(25);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [history, setHistory] = useState<SavedRecipe[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // simple responsive check
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const update = () => setIsWide(window.innerWidth > 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const canGenerate = useMemo(
    () => ingredients.trim().length > 0 && !loading,
    [ingredients, loading]
  );

  // Load history once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setHistory(parsed);
    } catch {
      // ignore
    }
  }, []);

  // Persist history whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  function pushToHistory(newRecipe: Recipe) {
    const item: SavedRecipe = {
      id: crypto.randomUUID(),
      savedAt: Date.now(),
      isFavorite: false,
      inputs: {
        ingredients,
        preferences,
        exclude,
        servings,
        maxTime,
      },
      recipe: newRecipe,
    };

    setHistory((prev) => [item, ...prev].slice(0, MAX_HISTORY));
    setSelectedHistoryId(item.id);
  }

  function selectHistory(item: SavedRecipe) {
    setSelectedHistoryId(item.id);
    setRecipe(item.recipe);

    // load inputs back into the form so user can tweak & generate again
    setIngredients(item.inputs.ingredients);
    setPreferences(item.inputs.preferences);
    setExclude(item.inputs.exclude);
    setServings(item.inputs.servings);
    setMaxTime(item.inputs.maxTime);

    setError(null);
  }

  function toggleFavorite(id: string) {
    setHistory((prev) =>
      prev.map((h) => (h.id === id ? { ...h, isFavorite: !h.isFavorite } : h))
    );
  }

  function clearHistory() {
    setHistory([]);
    setSelectedHistoryId(null);
  }

  async function generateRecipe({ avoidLastTitle = false }: { avoidLastTitle?: boolean } = {}) {
    if (!ingredients.trim()) {
      setError("Please enter some ingredients first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients,
          preferences,
          exclude,
          servings,
          maxTime,
          variation: Date.now(),
          avoidTitles: avoidLastTitle && recipe?.title ? [recipe.title] : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate recipe");
      }

      const r: Recipe = data.recipe;
      setRecipe(r);
      pushToHistory(r);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyRecipe() {
    if (!recipe) return;

    const text = [
      recipe.title,
      `Serves ${recipe.servings} • ${recipe.time_minutes} min`,
      recipe.warnings?.length ? `\nSafety:\n- ${recipe.warnings.join("\n- ")}` : "",
      `\nIngredients used:\n- ${recipe.ingredients_used.join("\n- ")}`,
      recipe.pantry_items_needed?.length
        ? `\nPantry add-ons:\n- ${recipe.pantry_items_needed.join("\n- ")}`
        : "",
      `\nSteps:\n${recipe.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
      recipe.tips?.length ? `\nTips:\n- ${recipe.tips.join("\n- ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(text);
    alert("Copied recipe to clipboard!");
  }

  function clearAllFields() {
    setIngredients("");
    setPreferences("");
    setExclude("");
    setServings(2);
    setMaxTime(25);
    setError(null);
  }

  const selected = selectedHistoryId
    ? history.find((h) => h.id === selectedHistoryId) ?? null
    : null;

  // Sort history: favorites first, then newest
  const historySorted = useMemo(() => {
    return [...history].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.savedAt - a.savedAt;
    });
  }, [history]);

  return (
    <div style={styles.bg}>
      <div style={styles.bgOverlay} />

      <main style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.h1}>Fridge Recipe Generator</h1>
          <p style={styles.subhead}>Tell me what you have — I’ll suggest a simple recipe.</p>
        </div>

        {/* TWO-COLUMN LAYOUT (desktop) / ONE-COLUMN (mobile) */}
        <div
          style={{
            ...styles.grid,
            gridTemplateColumns: isWide ? "2fr 1fr" : "1fr",
          }}
        >
          {/* LEFT COLUMN: Form + Recipe */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* FORM */}
            <section style={styles.card}>
              <div style={styles.rowBetween}>
                <label style={styles.label}>Ingredients</label>
                <button onClick={clearAllFields} style={styles.linkBtn} type="button">
                  Clear fields
                </button>
              </div>

              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                rows={6}
                style={styles.textarea}
                placeholder="eggs, milk, spinach, feta…"
              />

              <div style={styles.chips}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    style={styles.chip}
                    onClick={() => setIngredients(ex)}
                    disabled={loading}
                    title="Click to use example"
                  >
                    {ex}
                  </button>
                ))}
              </div>

              <label style={{ ...styles.label, marginTop: 12 }}>Preferences (optional)</label>
              <input
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                style={styles.input}
                placeholder="vegetarian, no oven, spicy, high-protein…"
              />

              <label style={{ ...styles.label, marginTop: 12 }}>Exclude ingredients (optional)</label>
              <input
                value={exclude}
                onChange={(e) => setExclude(e.target.value)}
                style={styles.input}
                placeholder="e.g. peanuts, shellfish, dairy…"
              />
              <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, opacity: 0.8 }}>
                We’ll avoid these completely (useful for allergies or dislikes).
              </p>

              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 800 }}>Advanced options</summary>
                <div style={styles.advanced}>
                  <div>
                    <label style={styles.smallLabel}>Servings</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={servings}
                      onChange={(e) => setServings(Number(e.target.value))}
                      style={styles.smallInput}
                    />
                  </div>
                  <div>
                    <label style={styles.smallLabel}>Max time (minutes)</label>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={maxTime}
                      onChange={(e) => setMaxTime(Number(e.target.value))}
                      style={styles.smallInput}
                    />
                  </div>
                </div>
              </details>

              <div style={styles.actions}>
                <button
                  onClick={() => generateRecipe({ avoidLastTitle: false })}
                  disabled={!canGenerate}
                  style={styles.primaryBtn}
                  type="button"
                >
                  {loading ? "Generating…" : "Generate recipe"}
                </button>

                <button
                  onClick={() => generateRecipe({ avoidLastTitle: true })}
                  disabled={!recipe || loading}
                  style={styles.secondaryBtn}
                  type="button"
                >
                  Not feeling this one
                </button>

                <button
                  onClick={copyRecipe}
                  disabled={!recipe || loading}
                  style={styles.secondaryBtn}
                  type="button"
                >
                  Copy
                </button>
              </div>

              {error && <p style={styles.error}>{error}</p>}
            </section>

            {/* RECIPE (left column, under form) */}
            {recipe && (
              <section style={styles.card}>
                <h2 style={styles.h2}>{recipe.title}</h2>
                <p style={styles.meta}>
                  Serves {recipe.servings} • {recipe.time_minutes} minutes
                </p>

                {recipe.warnings?.length > 0 && (
                  <div style={styles.warningBox}>
                    <strong>Safety</strong>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                      {recipe.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  style={{
                    ...styles.twoCol,
                    gridTemplateColumns: isWide ? "1fr 1fr" : "1fr",
                  }}
                >
                  <div>
                    <h3 style={styles.h3}>Ingredients used</h3>
                    <ul style={styles.ul}>
                      {recipe.ingredients_used.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>

                    {recipe.pantry_items_needed?.length > 0 && (
                      <>
                        <h3 style={styles.h3}>Pantry add-ons</h3>
                        <ul style={styles.ul}>
                          {recipe.pantry_items_needed.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div>
                    <h3 style={styles.h3}>Steps</h3>
                    <ol style={styles.ol}>
                      {recipe.instructions.map((s, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {recipe.tips?.length > 0 && (
                  <>
                    <h3 style={styles.h3}>Tips</h3>
                    <ul style={styles.ul}>
                      {recipe.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: History sidebar */}
          <section style={styles.card}>
            <div style={styles.rowBetween}>
              <h2 style={styles.h2}>History</h2>
              <button
                onClick={clearHistory}
                style={styles.linkBtn}
                type="button"
                disabled={history.length === 0}
              >
                Clear history
              </button>
            </div>

            {historySorted.length === 0 ? (
              <p style={{ opacity: 0.85, marginTop: 8 }}>
                Your last {MAX_HISTORY} recipes will appear here.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {historySorted.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      ...styles.historyItem,
                      borderColor:
                        selectedHistoryId === h.id
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(255,255,255,0.16)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => selectHistory(h)}
                        style={styles.historyTitleBtn}
                        title="Click to open"
                      >
                        {h.recipe.title}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFavorite(h.id)}
                        style={styles.starBtn}
                        title={h.isFavorite ? "Unfavourite" : "Favourite"}
                      >
                        {h.isFavorite ? "★" : "☆"}
                      </button>
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                      Serves {h.recipe.servings} • {h.recipe.time_minutes} min
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                      Inputs: {h.inputs.ingredients.slice(0, 60)}
                      {h.inputs.ingredients.length > 60 ? "…" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected && (
              <p style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
                Tip: clicking a history item also loads its inputs back into the form.
              </p>
            )}
          </section>
        </div>

        <footer style={styles.footer}>
          <span style={{ opacity: 0.85 }}>
            Your background image should be in <code style={styles.codeInline}>public/food-bg.png</code>.
          </span>
        </footer>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Full-page background (your collage)
  bg: {
    minHeight: "100vh",
    backgroundImage: "url(/food-bg.png)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
    position: "relative",
  },
  // Dark overlay to make text readable
  bgOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.30))",
    pointerEvents: "none",
  },

  // Page content sits above the overlay
  page: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1100,
    margin: "36px auto",
    padding: 16,
    fontFamily: "system-ui",
    color: "rgba(255,255,255,0.92)",
  },

  header: { marginBottom: 16 },
  h1: { fontSize: 34, margin: "0 0 6px", letterSpacing: -0.3 },
  subhead: { margin: 0, opacity: 0.85 },

  grid: { display: "grid", gap: 16 },

  // Glass card style
  card: {
    background: "rgba(20, 20, 20, 0.45)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  label: { display: "block", fontWeight: 800, marginBottom: 8, opacity: 0.95 },

  textarea: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.22)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.22)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
  },

  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.18)",
    color: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 13,
  },

  actions: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.14)",
    color: "rgba(255,255,255,0.95)",
    fontWeight: 800,
  },
  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.18)",
    color: "rgba(255,255,255,0.92)",
    fontWeight: 700,
  },

  linkBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textDecoration: "underline",
    color: "rgba(255,255,255,0.88)",
    opacity: 0.9,
  },

  error: { color: "#ffb4b4", marginTop: 12 },

  h2: { fontSize: 18, margin: 0, fontWeight: 900 },
  h3: { fontSize: 16, margin: "16px 0 8px", fontWeight: 900 },
  meta: { margin: "6px 0 0", opacity: 0.85 },

  ul: { margin: 0, paddingLeft: 18 },
  ol: { margin: 0, paddingLeft: 18 },

  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },

  twoCol: { display: "grid", gap: 16, marginTop: 8 },

  warningBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255, 204, 102, 0.35)",
    background: "rgba(120, 80, 10, 0.22)",
  },

  advanced: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 },
  smallLabel: { display: "block", fontWeight: 800, marginBottom: 6, fontSize: 13, opacity: 0.9 },
  smallInput: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.22)",
    color: "rgba(255,255,255,0.92)",
    width: 180,
    outline: "none",
  },

  historyItem: {
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 12,
    padding: 10,
    background: "rgba(0,0,0,0.18)",
  },
  historyTitleBtn: {
    border: "none",
    background: "transparent",
    textAlign: "left",
    padding: 0,
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1.2,
    color: "rgba(255,255,255,0.92)",
  },
  starBtn: {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.18)",
    borderRadius: 10,
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    color: "rgba(255,255,255,0.92)",
  },

  footer: { marginTop: 18, padding: 8, textAlign: "center" },

  codeInline: {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "2px 6px",
    borderRadius: 8,
    color: "rgba(255,255,255,0.9)",
  },
};