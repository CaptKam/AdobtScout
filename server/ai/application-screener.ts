
import OpenAI from "openai";
import type { AdoptionApplication } from "@shared/schema";

function getOpenAI(): OpenAI {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
  });
}

export interface ApplicationScreeningResult {
  overallScore: number; // 0-100
  recommendation: "approve" | "needs_review" | "reject";
  redFlags: Array<{
    severity: "high" | "medium" | "low";
    category: string;
    concern: string;
    evidence: string;
  }>;
  positiveSignals: string[];
  suggestedQuestions: string[];
  rationale: string;
}

export async function screenApplication(
  application: AdoptionApplication,
  dogProfile: any,
  applicantHistory?: any
): Promise<ApplicationScreeningResult> {
  const prompt = `You are an expert adoption coordinator. Analyze this adoption application and identify any red flags or concerns.

DOG PROFILE:
${JSON.stringify(dogProfile, null, 2)}

APPLICATION DATA:
${JSON.stringify(application, null, 2)}

${applicantHistory ? `APPLICANT HISTORY:\n${JSON.stringify(applicantHistory, null, 2)}` : ""}

Analyze for:
1. Red flags (inconsistencies, concerning patterns, unsuitable living situation)
2. Compatibility issues (dog needs vs applicant lifestyle)
3. Experience level concerns
4. Housing/landlord issues
5. Financial readiness
6. Previous pet ownership patterns

Return JSON with:
- overallScore (0-100, where 100 is perfect match)
- recommendation ("approve", "needs_review", "reject")
- redFlags (array of concerns with severity, category, concern, evidence)
- positiveSignals (array of encouraging aspects)
- suggestedQuestions (follow-up questions to ask)
- rationale (brief explanation of recommendation)`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: "You are an adoption screening AI. Return only valid JSON." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1500,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return result as ApplicationScreeningResult;
}
