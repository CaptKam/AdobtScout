import { eventBus, HealthScreeningAnalyzePayload, HealthScreeningResult } from '../../events/event-bus';

async function analyzeHealthScreening(payload: HealthScreeningAnalyzePayload): Promise<void> {
  const { requestPayload, resolve, reject } = payload;
  
  try {
    const { GoogleGenAI, Type } = await import('@google/genai');

    const ai = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
    });

    let result: HealthScreeningResult;

    if (requestPayload.screeningType === 'intake_health_snapshot') {
      result = await analyzeIntakeScreening(ai, Type, requestPayload);
    } else {
      result = await analyzeGeneralScreening(ai, Type, requestPayload);
    }

    resolve(result);
  } catch (error: any) {
    console.error('[Health Screening Plugin] AI analysis error:', error);
    reject(new Error(`AI analysis failed: ${error.message}`));
  }
}

async function analyzeGeneralScreening(
  ai: any,
  Type: any,
  payload: HealthScreeningAnalyzePayload['requestPayload']
): Promise<HealthScreeningResult> {
  const { dogContext, petIdentification, symptoms, images, screeningType } = payload;

  let petIdContext = "";
  if (petIdentification) {
    petIdContext = `
AI-Identified Pet Information (from photo scan):
- Breed: ${petIdentification.breed || 'Unknown'} (${petIdentification.breedConfidence || 'unknown'} confidence)
- Size: ${petIdentification.size || 'Unknown'}
- Age Category: ${petIdentification.ageCategory || 'Unknown'}
- Coat Color: ${petIdentification.coatColor || 'Unknown'}
- Estimated Weight: ${petIdentification.estimatedWeight || 'Unknown'}
`;
  }

  let prompt = `You are a veterinary health assessment AI assistant. Your role is to help shelter staff assess pet health conditions based on symptoms and/or images.

IMPORTANT DISCLAIMERS:
- This is NOT a replacement for professional veterinary care
- This is a preliminary screening tool only
- Always recommend professional veterinary evaluation for any concerning findings

${dogContext || ''}
${petIdContext}
`;

  const parts: any[] = [];

  if (symptoms) {
    prompt += `
REPORTED SYMPTOMS:
${symptoms}

`;
  }

  if (screeningType === 'image_analysis' || screeningType === 'full_assessment') {
    prompt += `
IMAGE ANALYSIS INSTRUCTIONS:
Analyze any provided images carefully looking for:
1. Eyes: Redness, discharge, cloudiness, swelling
2. Skin/Coat: ANY rashes, lesions, hair loss, parasites, wounds, color changes, or abnormal conditions (SKIN ISSUES ARE ALWAYS AT LEAST MODERATE CONCERN)
3. Teeth/Gums: Discoloration, swelling, broken teeth, gum disease signs
4. Ears: Discharge, redness, swelling
5. Posture/Body condition: Weight issues, stance abnormalities
6. Any visible injuries or abnormalities

SEVERITY GUIDELINES:
- ANY visible skin condition (rashes, lesions, hair loss, discoloration) = AT LEAST "moderate" severity, potentially "high"
- Skin conditions require veterinary evaluation and close monitoring
`;
  }

  prompt += `
Provide a comprehensive health assessment with:
1. SEVERITY: Rate as "low", "moderate", "high", or "critical" - Remember: skin conditions are at least moderate
2. RECOMMENDATION: Choose one - "home_care" (can be managed at shelter), "monitor" (watch closely), "vet_visit" (schedule vet appointment soon), "emergency" (needs immediate veterinary attention)
3. DETECTED/SUSPECTED CONDITIONS: List any health issues identified
4. DETAILED ANALYSIS: Explain your findings
5. CARE INSTRUCTIONS: If applicable, provide home care guidance

Analyze now and provide your assessment:`;

  parts.push({ text: prompt });

  if (images && images.length > 0) {
    for (const image of images) {
      const matches = image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
    }
  }

  console.log(`[Health Screening Plugin] Running ${screeningType} analysis for dog ${payload.dogId || 'unknown'}`);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ["low", "moderate", "high", "critical"] },
          recommendation: { type: Type.STRING, enum: ["home_care", "monitor", "vet_visit", "emergency"] },
          conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
          analysis: { type: Type.STRING },
          careInstructions: { type: Type.STRING },
        },
        required: ["severity", "recommendation", "analysis"],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response from AI");
  }

  const result = JSON.parse(responseText);
  console.log(`[Health Screening Plugin] Analysis complete - Severity: ${result.severity}, Recommendation: ${result.recommendation}`);

  return result;
}

async function analyzeIntakeScreening(
  ai: any,
  Type: any,
  payload: HealthScreeningAnalyzePayload['requestPayload']
): Promise<HealthScreeningResult> {
  const { dogContext, capturedBodyParts, photoEntries } = payload;

  const prompt = `You are a veterinary health assessment AI assistant performing an intake health snapshot for a dog arriving at a shelter.

IMPORTANT DISCLAIMERS:
- This is NOT a replacement for professional veterinary care
- This is a preliminary screening tool for shelter intake
- Always flag concerning findings for veterinary follow-up

${dogContext || ''}

BODY AREAS PHOTOGRAPHED: ${capturedBodyParts?.join(', ') || 'Unknown'}

ANALYZE EACH PHOTO CAREFULLY looking for:
1. Eyes: Redness, discharge, cloudiness, swelling, infections
2. Ears: Discharge, redness, swelling, mites, infections
3. Skin/Coat: Rashes, lesions, hair loss, parasites, wounds, hot spots, mange
4. Teeth/Gums: Discoloration, swelling, broken teeth, gum disease, tartar buildup
5. Full Body: Overall condition, posture, weight issues, visible injuries

For each concerning finding, note:
- Which body area
- What was observed
- Severity level
- Recommended action

Provide a comprehensive intake health assessment:`;

  const parts: any[] = [{ text: prompt }];

  if (photoEntries && photoEntries.length > 0) {
    for (const entry of photoEntries) {
      const areaLabel = entry.area.toUpperCase().replace(/_/g, ' ');
      const descriptionText = entry.description ? `\nStaff concern: "${entry.description}"` : '';
      parts.push({ text: `\n[${areaLabel} PHOTO]:${descriptionText}\n` });
      const matches = entry.image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
    }
  }

  console.log(`[Health Screening Plugin] Running intake analysis for dog ${payload.dogId} with ${capturedBodyParts?.length || 0} photos`);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ["low", "moderate", "high", "critical"] },
          recommendation: { type: Type.STRING, enum: ["home_care", "monitor", "vet_visit", "emergency"] },
          conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
          analysis: { type: Type.STRING },
          careInstructions: { type: Type.STRING },
          concernsByArea: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                bodyArea: { type: Type.STRING },
                concern: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ["low", "moderate", "high", "critical"] },
                actionNeeded: { type: Type.STRING },
              },
              required: ["bodyArea", "concern", "severity", "actionNeeded"],
            },
          },
        },
        required: ["severity", "recommendation", "analysis"],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response from AI");
  }

  const result = JSON.parse(responseText);
  console.log(`[Health Screening Plugin] Intake analysis complete - Severity: ${result.severity}, Recommendation: ${result.recommendation}`);

  return result;
}

export function registerAIAnalyzer(): void {
  eventBus.on('health_screening.analyze', analyzeHealthScreening);
  console.log('[Health Screening Plugin] AI Analyzer registered');
}

export function unregisterAIAnalyzer(): void {
  eventBus.off('health_screening.analyze', analyzeHealthScreening);
  console.log('[Health Screening Plugin] AI Analyzer unregistered');
}
