import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

export const runtime = "nodejs";

const RecipeSchema = z.object({
  title: z.string(),
  servings: z.number().int().min(1).max(12),
  time_minutes: z.number().int().min(1).max(240),
  ingredients_used: z.array(z.string()).min(1),
  pantry_items_needed: z.array(z.string()).default([]),
  instructions: z.array(z.string()).min(2),
  tips: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "Missing OPENAI_API_KEY. In Vercel, add it in Settings → Environment Variables, then redeploy.",
        },
        { status: 500 }
      );
    }

    // ✅ Create the client ONLY after we know the key exists
    const openai = new OpenAI({ apiKey });

    const body = await req.json();
    const ingredients = String(body.ingredients ?? "").trim();
    const preferences = String(body.preferences ?? "").trim();
    const exclude = String(body.exclude ?? "").trim();
    const variation = String(body.variation ?? "").trim();

    const avoidTitles = Array.isArray(body.avoidTitles)
      ? body.avoidTitles.map((t: any) => String(t).trim()).filter(Boolean)
      : [];

    const servings = Number(body.servings ?? 2);
    const maxTime = Number(body.maxTime ?? 25);

    if (!ingredients) {
      return Response.json({ error: "Please enter some ingredients." }, { status: 400 });
    }

    const prompt = `
Create a simple, beginner-friendly recipe.

User ingredients: ${ingredients}
Preferences: ${preferences || "none"}

Constraints (must follow):
- Servings: ${servings}
- Max total time: ${maxTime} minutes

Exclude (must follow):
- ${exclude || "none"}

Variation id: ${variation || "none"}
Avoid these recipe titles (must follow):
- ${avoidTitles.length ? avoidTitles.join("\n- ") : "none"}

Rules:
- Use mostly the user's ingredients.
- Do NOT use any excluded ingredients. If an excluded ingredient appears in the user's ingredient list, treat it as unavailable.
- If "Avoid these recipe titles" is not "none", do NOT return a recipe that matches them or is essentially the same dish.
- Choose a noticeably different dish style from the previous attempt (e.g. bowl vs wrap vs soup vs stir-fry vs salad vs omelette).
- You may suggest a short list of common pantry additions (keep it short).
- Keep steps clear and numbered.
- Do not invent fancy equipment.
- Include a food-safety warning if relevant (raw meat/eggs, etc).
- Choose a realistic recipe that can be completed within the max time.
- Set "servings" in the output to the requested servings.
- Set "time_minutes" in the output to a value <= the max time.
`.trim();

    const result = await openai.responses.parse({
      model: "gpt-4o-mini",
      input: prompt,
      text: {
        format: zodTextFormat(RecipeSchema, "recipe"),
      },
    });

    return Response.json({ recipe: result.output_parsed });
  } catch (err: any) {
    console.error("Recipe route error:", err);
    return Response.json(
      { error: err?.message || "Failed to generate recipe (server error)." },
      { status: 500 }
    );
  }
}