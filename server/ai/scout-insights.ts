// Scout Insights Engine - Extracts and stores user preferences from conversations
// This module analyzes chat messages and swipe patterns to learn user preferences

import OpenAI from "openai";
import { db, schema } from "../db";
import { eq, and, inArray, sql } from "drizzle-orm";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Types for insight extraction
interface ExtractedInsight {
  insightType: "preference" | "concern" | "lifestyle" | "experience" | "requirement";
  category: string;
  value: string;
  confidence: number;
}

// Extract insights from a user message using AI
export async function extractInsightsFromMessage(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  messageId?: string
): Promise<ExtractedInsight[]> {
  const prompt = `Analyze this conversation exchange and extract any user preferences, concerns, or lifestyle details about dog adoption.

USER MESSAGE: "${userMessage}"
ASSISTANT RESPONSE: "${assistantResponse}"

Extract insights as JSON array. Each insight should have:
- insightType: "preference" | "concern" | "lifestyle" | "experience" | "requirement"
- category: "size" | "energy" | "temperament" | "breed" | "age" | "living_situation" | "family" | "experience_level" | "schedule" | "health" | "training" | "compatibility"
- value: specific preference value (e.g., "prefers small dogs", "works from home", "has young children")
- confidence: 0.0-1.0 based on how explicitly stated (explicit=0.9+, implied=0.6-0.8, vague=0.3-0.5)

Only extract genuine insights. Return empty array if no clear preferences/concerns.

Examples:
- "I work from home" → {insightType: "lifestyle", category: "schedule", value: "works from home", confidence: 0.95}
- "I have a small apartment" → {insightType: "lifestyle", category: "living_situation", value: "lives in small apartment", confidence: 0.9}
- "I think I'd prefer a calmer dog" → {insightType: "preference", category: "energy", value: "prefers calm/low energy dogs", confidence: 0.7}
- "Worried about destructive behavior" → {insightType: "concern", category: "training", value: "concerned about destructive behavior", confidence: 0.85}

Return ONLY valid JSON array:`;

  try {
    console.log(`[Scout Insights] Extracting insights for user ${userId} from message: "${userMessage.substring(0, 50)}..."`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are an insight extraction system. Extract user preferences about dog adoption from conversations. Return a JSON object with an 'insights' array." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    console.log(`[Scout Insights] AI response: ${content?.substring(0, 200)}`);
    
    if (!content) {
      console.log("[Scout Insights] No content in response");
      return [];
    }

    const parsed = JSON.parse(content);
    
    // Handle various response formats
    let insights: ExtractedInsight[] = [];
    if (Array.isArray(parsed)) {
      insights = parsed;
    } else if (Array.isArray(parsed.insights)) {
      insights = parsed.insights;
    } else if (Array.isArray(parsed.data)) {
      insights = parsed.data;
    } else if (Array.isArray(parsed.extracted_insights)) {
      insights = parsed.extracted_insights;
    }
    
    console.log(`[Scout Insights] Extracted ${insights.length} insights`);
    
    if (insights.length === 0) return [];

    // Store insights in database
    for (const insight of insights) {
      if (insight.insightType && insight.category && insight.value) {
        // Provide default confidence if not specified by AI
        const normalizedInsight: ExtractedInsight = {
          insightType: insight.insightType,
          category: insight.category,
          value: insight.value,
          confidence: typeof insight.confidence === 'number' ? insight.confidence : 0.6
        };
        await storeInsight(userId, normalizedInsight, "chat", messageId);
      }
    }

    return insights;
  } catch (error) {
    console.error("[Scout Insights] Error extracting insights:", error);
    return [];
  }
}

// Store or update an insight in the database
async function storeInsight(
  userId: string,
  insight: ExtractedInsight,
  source: string,
  sourceMessageId?: string
): Promise<void> {
  try {
    // Check for existing similar insight
    const existing = await db.select()
      .from(schema.scoutInsights)
      .where(and(
        eq(schema.scoutInsights.userId, userId),
        eq(schema.scoutInsights.category, insight.category),
        eq(schema.scoutInsights.value, insight.value)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Reinforce existing insight
      const current = existing[0];
      const newConfidence = Math.min(1.0, current.confidence + 0.1);
      const newCount = current.reinforcementCount + 1;

      await db.update(schema.scoutInsights)
        .set({
          confidence: newConfidence,
          reinforcementCount: newCount,
          lastReinforced: new Date(),
        })
        .where(eq(schema.scoutInsights.id, current.id));

      console.log(`[Scout Insights] Reinforced insight: ${insight.category}/${insight.value} (confidence: ${newConfidence})`);
    } else {
      // Create new insight
      await db.insert(schema.scoutInsights)
        .values({
          userId,
          insightType: insight.insightType,
          category: insight.category,
          value: insight.value,
          confidence: insight.confidence,
          source,
          sourceMessageId: sourceMessageId || null,
        });

      console.log(`[Scout Insights] New insight: ${insight.category}/${insight.value} (confidence: ${insight.confidence})`);
    }
  } catch (error) {
    console.error("[Scout Insights] Error storing insight:", error);
  }
}

// Analyze swipe patterns and extract preferences
export async function analyzeSwipePatterns(userId: string): Promise<void> {
  try {
    console.log(`[Scout Insights] Analyzing swipe patterns for user ${userId}`);
    
    // Get recent swipes
    const swipes = await db.select()
      .from(schema.swipes)
      .where(eq(schema.swipes.userId, userId))
      .limit(50);

    if (swipes.length < 5) {
      console.log(`[Scout Insights] Not enough swipes (${swipes.length}) for user ${userId}`);
      return; // Need enough data
    }

    const dogIds = swipes.map(s => s.dogId);
    
    if (dogIds.length === 0) return;
    
    const dogs = await db.select()
      .from(schema.dogs)
      .where(inArray(schema.dogs.id, dogIds));

    const dogMap = new Map(dogs.map(d => [d.id, d]));

    // Analyze patterns
    const likedDogs = swipes
      .filter(s => s.direction === "right")
      .map(s => dogMap.get(s.dogId))
      .filter(Boolean);

    const passedDogs = swipes
      .filter(s => s.direction === "left")
      .map(s => dogMap.get(s.dogId))
      .filter(Boolean);

    if (likedDogs.length < 3) return;

    // Calculate size preference
    const sizeCount: Record<string, number> = {};
    for (const dog of likedDogs) {
      if (dog) sizeCount[dog.size] = (sizeCount[dog.size] || 0) + 1;
    }
    const dominantSize = Object.entries(sizeCount)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (dominantSize && dominantSize[1] >= 3) {
      const confidence = Math.min(0.9, dominantSize[1] / likedDogs.length + 0.2);
      await storeInsight(userId, {
        insightType: "preference",
        category: "size",
        value: `prefers ${dominantSize[0]} dogs`,
        confidence,
      }, "swipe_pattern");
    }

    // Calculate energy preference
    const energyCount: Record<string, number> = {};
    for (const dog of likedDogs) {
      if (dog) energyCount[dog.energyLevel] = (energyCount[dog.energyLevel] || 0) + 1;
    }
    const dominantEnergy = Object.entries(energyCount)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (dominantEnergy && dominantEnergy[1] >= 3) {
      const confidence = Math.min(0.9, dominantEnergy[1] / likedDogs.length + 0.2);
      await storeInsight(userId, {
        insightType: "preference",
        category: "energy",
        value: `gravitates toward ${dominantEnergy[0]} energy dogs`,
        confidence,
      }, "swipe_pattern");
    }

    // Calculate temperament preferences
    const tempCount: Record<string, number> = {};
    for (const dog of likedDogs) {
      if (dog) {
        for (const temp of dog.temperament) {
          tempCount[temp] = (tempCount[temp] || 0) + 1;
        }
      }
    }
    const topTemps = Object.entries(tempCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .filter(t => t[1] >= 3);

    for (const [temp, count] of topTemps) {
      const confidence = Math.min(0.85, count / likedDogs.length + 0.15);
      await storeInsight(userId, {
        insightType: "preference",
        category: "temperament",
        value: `loves ${temp} dogs`,
        confidence,
      }, "swipe_pattern");
    }

    console.log(`[Scout Insights] Analyzed swipe patterns for user ${userId}: ${likedDogs.length} likes, ${passedDogs.length} passes`);
  } catch (error) {
    console.error("[Scout Insights] Error analyzing swipe patterns:", error);
  }
}

// Decay old insights that haven't been reinforced
export async function decayOldInsights(): Promise<void> {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  try {
    // Reduce confidence of old insights
    await db.update(schema.scoutInsights)
      .set({
        confidence: sql`GREATEST(0.1, ${schema.scoutInsights.confidence} - 0.1)`,
      })
      .where(sql`${schema.scoutInsights.lastReinforced} < ${oneMonthAgo}`);

    // Deactivate very low confidence insights
    await db.update(schema.scoutInsights)
      .set({ isActive: false })
      .where(sql`${schema.scoutInsights.confidence} < 0.2`);

    console.log("[Scout Insights] Decayed old insights");
  } catch (error) {
    console.error("[Scout Insights] Error decaying insights:", error);
  }
}

// Get high-confidence insights for a user
export async function getHighConfidenceInsights(userId: string): Promise<any[]> {
  try {
    return await db.select()
      .from(schema.scoutInsights)
      .where(and(
        eq(schema.scoutInsights.userId, userId),
        eq(schema.scoutInsights.isActive, true),
        sql`${schema.scoutInsights.confidence} >= 0.6`
      ))
      .orderBy(sql`${schema.scoutInsights.confidence} DESC`)
      .limit(10);
  } catch (error) {
    console.error("[Scout Insights] Error fetching insights:", error);
    return [];
  }
}
