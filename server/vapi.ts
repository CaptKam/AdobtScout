import { db } from "./db";
import { adoptionJourneys, scoutInsights, consultationCalls, dogs, userProfiles, users, phoneScreeningQuestions, vapiKnowledgeBase } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { extractInsightsFromMessage } from "./ai/scout-insights";
import OpenAI from "openai";

// Helper function to fetch published knowledge base entries
async function getKnowledgeBaseContext(): Promise<string> {
  const entries = await db
    .select()
    .from(vapiKnowledgeBase)
    .where(eq(vapiKnowledgeBase.isPublished, true));

  if (entries.length === 0) return "";

  return entries.map(entry =>
    `### ${entry.title}\n${entry.content}`
  ).join("\n\n");
}

// Helper function to fetch breed-specific knowledge for phone screening
async function getBreedKnowledge(breed: string): Promise<string | null> {
  if (!breed) return null;

  // Normalize breed name for matching (case-insensitive, partial match)
  const normalizedBreed = breed.toLowerCase().trim();

  // Fetch all breed_info entries
  const breedEntries = await db
    .select()
    .from(vapiKnowledgeBase)
    .where(
      and(
        eq(vapiKnowledgeBase.category, 'breed_info'),
        eq(vapiKnowledgeBase.isPublished, true)
      )
    );

  if (breedEntries.length === 0) return null;

  // Find matching breed entry (case-insensitive match)
  const matchingEntry = breedEntries.find(entry =>
    entry.title.toLowerCase().includes(normalizedBreed) ||
    normalizedBreed.includes(entry.title.toLowerCase())
  );

  if (matchingEntry) {
    return matchingEntry.content;
  }

  // Check if it's a mix breed - look for primary breed matches
  const breedWords = normalizedBreed.split(/[\s\-\/]+/);
  for (const word of breedWords) {
    if (word.length < 3 || ['mix', 'mixed', 'breed', 'cross'].includes(word)) continue;
    const partialMatch = breedEntries.find(entry =>
      entry.title.toLowerCase().includes(word)
    );
    if (partialMatch) {
      return `Note: ${breed} may share characteristics with ${partialMatch.title}:\n\n${partialMatch.content}`;
    }
  }

  return null;
}

// Helper function to fetch active phone screening questions
async function getPhoneScreeningQuestions(scenario: string = "adoption"): Promise<string> {
  const questions = await db
    .select()
    .from(phoneScreeningQuestions)
    .where(eq(phoneScreeningQuestions.isActive, true))
    .orderBy(asc(phoneScreeningQuestions.position));

  if (questions.length === 0) return "";

  // Group questions by category
  const byCategory = questions.reduce((acc, q) => {
    const cat = q.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(q);
    return acc;
  }, {} as Record<string, typeof questions>);

  let result = "";
  for (const [category, qs] of Object.entries(byCategory)) {
    const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
    result += `\n**${categoryTitle}:**\n`;
    qs.forEach((q, i) => {
      result += `${i + 1}. ${q.questionText}\n`;
      if (q.aiPrompt) result += `   (AI guidance: ${q.aiPrompt})\n`;
    });
  }

  return result;
}

// Import application questions tables
import { applicationQuestions, shelterApplicationQuestions, shelterApplicationForms } from "@shared/schema";

// Helper function to get combined application questions (admin + shelter) for VAPI
export async function getApplicationQuestionsForVapi(shelterId?: string): Promise<string> {
  // Get platform (admin) application questions
  const adminQuestions = await db
    .select()
    .from(applicationQuestions)
    .where(eq(applicationQuestions.isActive, true))
    .orderBy(asc(applicationQuestions.position));

  let shelterQuestionsData: any[] = [];
  
  // Get shelter-specific questions if shelterId is provided
  if (shelterId) {
    // First find the shelter's application form
    const [form] = await db
      .select()
      .from(shelterApplicationForms)
      .where(eq(shelterApplicationForms.shelterId, shelterId));
    
    if (form) {
      shelterQuestionsData = await db
        .select()
        .from(shelterApplicationQuestions)
        .where(
          and(
            eq(shelterApplicationQuestions.formId, form.id),
            eq(shelterApplicationQuestions.isActive, true)
          )
        )
        .orderBy(asc(shelterApplicationQuestions.position));
    }
  }

  if (adminQuestions.length === 0 && shelterQuestionsData.length === 0) {
    return "";
  }

  let result = "\n**APPLICATION QUESTIONS TO COVER:**\n";
  result += "These are additional questions from the adoption application that should be discussed naturally during the call:\n\n";

  // Add platform questions
  if (adminQuestions.length > 0) {
    result += "**Platform Standard Questions:**\n";
    adminQuestions.forEach((q, i) => {
      result += `${i + 1}. ${q.questionText}`;
      if (q.isRequired) result += " (Required)";
      result += "\n";
      if (q.helperText) result += `   Note: ${q.helperText}\n`;
    });
    result += "\n";
  }

  // Add shelter-specific questions
  if (shelterQuestionsData.length > 0) {
    result += "**Shelter-Specific Questions:**\n";
    shelterQuestionsData.forEach((q, i) => {
      result += `${i + 1}. ${q.questionText}`;
      if (q.isRequired) result += " (Required)";
      result += "\n";
      if (q.helperText) result += `   Note: ${q.helperText}\n`;
    });
  }

  return result;
}

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = "https://api.vapi.ai";

interface VapiCallPayload {
  phoneNumberId?: string; // Your Vapi phone number ID for outbound calls
  customer?: {
    number: string;
    name?: string;
  };
  assistantId?: string;
  assistant?: {
    model: {
      provider: string;
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    voice: {
      provider: string;
      voiceId: string;
    };
    firstMessage: string;
    endCallMessage: string;
    transcriber: {
      provider: string;
      model: string;
      language: string;
    };
    artifactPlan?: {
      recordingEnabled: boolean;
      transcriptPlan: {
        enabled: boolean;
        assistantName?: string;
        userName?: string;
      };
    };
  };
  metadata?: Record<string, string>;
}

// Vapi phone number ID - must be configured in Vapi dashboard
// This is the outbound phone number that Scout uses to make calls
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

interface VapiCallResponse {
  id: string;
  status: string;
  phoneNumber: string;
  createdAt: string;
  endedAt?: string;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
}

// Advanced Vapi features
interface CallAnalytics {
  sentimentScore: number;
  concerningPatterns: string[];
  positiveIndicators: string[];
  recommendedFollowUp: string[];
}

export async function analyzeCallTranscript(transcript: string): Promise<CallAnalytics> {
  const openai = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  });

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: "Analyze adoption phone screening calls for sentiment, red flags, and insights." },
      { role: "user", content: `Analyze this phone screening transcript:\n\n${transcript}\n\nReturn JSON with sentimentScore (0-100), concerningPatterns (array), positiveIndicators (array), recommendedFollowUp (array)` }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 800,
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

// Quick Apply screening analysis result
export interface QuickApplyScreeningResult {
  canSkipScreening: boolean;
  reason: string;
  followUpQuestions: string[];
  previousScreeningSummary: string;
  confidenceScore: number;
}

// Analyze previous phone screenings to determine if user can skip to meet & greet
export async function analyzeForQuickApply(
  userId: string,
  newDogId: string,
  previousScreenings: Array<{
    dogBreed: string;
    dogSize: string;
    dogEnergy: string;
    transcript: string | null;
    summary: string | null;
    screeningNotes: string | null;
    completedAt: Date | null;
  }>
): Promise<QuickApplyScreeningResult> {
  const openai = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  });

  // Fetch new dog details
  const [newDog] = await db.select().from(dogs).where(eq(dogs.id, newDogId));

  // Fetch user profile for context
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));

  if (!newDog || previousScreenings.length === 0) {
    return {
      canSkipScreening: false,
      reason: "No previous screening history available",
      followUpQuestions: [],
      previousScreeningSummary: "",
      confidenceScore: 0
    };
  }

  // Build context about previous screenings
  const screeningContext = previousScreenings
    .filter(s => s.transcript || s.summary)
    .map((s, i) => `
--- Previous Screening ${i + 1} ---
Dog: ${s.dogBreed} (${s.dogSize} size, ${s.dogEnergy} energy)
${s.summary ? `Summary: ${s.summary}` : ''}
${s.screeningNotes ? `Notes: ${s.screeningNotes}` : ''}
${s.transcript ? `Transcript excerpt: ${s.transcript.slice(0, 1500)}...` : ''}
`).join('\n');

  const newDogContext = `
--- New Dog Being Applied For ---
Name: ${newDog.name}
Breed: ${newDog.breed}
Size: ${newDog.size}
Energy Level: ${newDog.energyLevel}
Good with kids: ${newDog.goodWithKids ? 'Yes' : 'No'}
Good with dogs: ${newDog.goodWithDogs ? 'Yes' : 'No'}
Good with cats: ${newDog.goodWithCats ? 'Yes' : 'No'}
Special needs: ${newDog.specialNeeds || 'None'}
`;

  const userContext = profile ? `
--- Applicant Profile ---
Home type: ${profile.homeType || 'Unknown'}
Has yard: ${profile.hasYard ? 'Yes' : 'No'}
Has other pets: ${profile.hasOtherPets ? `Yes (${profile.otherPetsType || 'unspecified'})` : 'No'}
Experience level: ${profile.experienceLevel || 'Unknown'}
Activity level: ${profile.activityLevel || 'Unknown'}
` : '';

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are an expert adoption coordinator analyzing whether a returning applicant can skip a phone screening based on their previous screening history.

Your goal is to determine if we have enough information from previous calls to confidently approve them for a meet & greet with the new dog, OR if there are specific follow-up questions we need to ask.

Consider:
1. Did previous screenings reveal a suitable living situation?
2. Does the applicant's experience match what the new dog needs?
3. Are there any new concerns based on the new dog's specific requirements?
4. Is the new dog significantly different from previously screened dogs (size, energy, special needs)?

Be conservative - if in doubt, require follow-up questions. But if the previous screening was thorough and the new dog is similar, allow skipping.`
        },
        {
          role: "user",
          content: `Analyze if this returning applicant can skip phone screening for their new dog application:

${screeningContext}

${newDogContext}

${userContext}

Return JSON with:
- canSkipScreening (boolean): true if previous screening covered enough for this dog
- reason (string): explain the decision
- followUpQuestions (array of strings): specific questions needed if any, empty if canSkipScreening is true
- previousScreeningSummary (string): key points learned from previous screenings
- confidenceScore (number 0-100): how confident we are in this decision`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      canSkipScreening: result.canSkipScreening || false,
      reason: result.reason || "Analysis incomplete",
      followUpQuestions: result.followUpQuestions || [],
      previousScreeningSummary: result.previousScreeningSummary || "",
      confidenceScore: result.confidenceScore || 0
    };
  } catch (error) {
    console.error("Error analyzing for quick apply:", error);
    return {
      canSkipScreening: false,
      reason: "Error during analysis - requires manual screening",
      followUpQuestions: [],
      previousScreeningSummary: "",
      confidenceScore: 0
    };
  }
}

export async function createPhoneScreeningPrompt(
  journeyId: string,
  dogId: string,
  userId: string
): Promise<string> {
  // Fetch dog details
  const [dog] = await db.select().from(dogs).where(eq(dogs.id, dogId));

  // Fetch user profile
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));

  // Fetch user info
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  const dogBreed = dog?.breed || "mixed breed";
  const shelterId = dog?.shelterId; // The dog's shelterId references the shelter

  // Fetch dynamic content from database (including breed-specific knowledge and application questions)
  const [knowledgeBase, screeningQuestions, breedKnowledge, applicationQuestionsList] = await Promise.all([
    getKnowledgeBaseContext(),
    getPhoneScreeningQuestions("adoption"),
    getBreedKnowledge(dogBreed),
    getApplicationQuestionsForVapi(shelterId)
  ]);

  const dogName = dog?.name || "the dog";
  const dogEnergy = dog?.energyLevel || "moderate";
  const dogSize = dog?.size || "medium";
  const dogAge = dog?.ageCategory || "adult";
  const dogGoodWithKids = dog?.goodWithKids ? "great with children" : "may need a home without small children";
  const dogGoodWithDogs = dog?.goodWithDogs ? "friendly with other dogs" : "may prefer to be the only pet";
  const dogGoodWithCats = dog?.goodWithCats ? "good with cats" : "may not be suitable for homes with cats";
  const dogSpecialNeeds = dog?.specialNeeds || "no special needs";

  const userName = user?.firstName || "there";
  const homeType = profile?.homeType || "home";
  const hasYard = profile?.hasYard ? "has a yard" : "doesn't have a yard";
  const hasOtherPets = profile?.hasOtherPets ? `has other pets (${profile.otherPetsType || 'pets'})` : "doesn't have other pets";
  const experienceLevel = profile?.experienceLevel || "some experience";
  const activityLevel = profile?.activityLevel || "moderate";

  return `You are Scout, a warm and compassionate AI assistant for Scout Dog Adoption. You're conducting a phone screening call with ${userName} who has applied to adopt ${dogName}, a ${dogAge} ${dogSize} ${dogBreed} with ${dogEnergy} energy.

ABOUT THE DOG:
- Name: ${dogName}
- Breed: ${dogBreed}
- Size: ${dogSize}
- Age: ${dogAge}
- Energy Level: ${dogEnergy}
- ${dogGoodWithKids}
- ${dogGoodWithDogs}
- ${dogGoodWithCats}
- Special needs: ${dogSpecialNeeds}
${breedKnowledge ? `
BREED-SPECIFIC INSIGHTS (${dogBreed}):
Use this knowledge to guide your questions and assess compatibility:

${breedKnowledge}

Based on this breed information, pay special attention to:
- Whether the applicant's living situation matches breed requirements
- If their activity level aligns with the breed's exercise needs
- Any potential red flags mentioned above for this breed type
` : ""}
ABOUT THE APPLICANT:
- Name: ${userName}
- Home type: ${homeType}
- ${hasYard}
- ${hasOtherPets}
- Experience level: ${experienceLevel}
- Activity level: ${activityLevel}

YOUR GOALS:
1. Build rapport and make the caller feel comfortable
2. Verify their living situation and daily routine
3. Understand their experience with dogs
4. Assess their preparedness for ${dogName}'s specific needs (especially energy level: ${dogEnergy})
5. Answer any questions they have about the adoption process

SCREENING QUESTIONS TO COVER:
Use these questions naturally throughout the conversation. You don't need to ask all of them - focus on the most relevant ones based on the conversation flow.
${screeningQuestions || `
**Living Situation:**
1. Can you tell me about your living situation? Do you live in a house, apartment, or condo?
2. Do you have access to a yard or outdoor space where a dog could play or exercise?

**Experience:**
1. Have you had dogs before? Tell me about your experience with dogs.
2. Are there any specific challenges you faced with previous dogs, and how did you handle them?

**Lifestyle:**
1. What does a typical day look like for you? How much time would you be home with the dog?
2. How much time each day could you dedicate to exercising and playing with a dog?

**Household:**
1. Who else lives in your household? Are there any children, and if so, what are their ages?
2. Do you have any other pets at home currently? Tell me about them.

**Commitment:**
1. Do you have a veterinarian, or have you researched vets in your area?
2. If you had an emergency or needed to travel, who would care for the dog?
3. Dogs can live 10-15 years or more. How do you see this dog fitting into your life long-term?
`}

CONVERSATION STRUCTURE:
1. Warm greeting and introduction
2. Confirm they're still interested in ${dogName}
3. Ask about their home environment and daily schedule
4. Discuss their experience with dogs
5. Ask how they'd handle ${dogName}'s exercise needs (${dogEnergy} energy)
6. If they have other pets: Ask about introductions and compatibility
7. Ask if they have any questions
8. Explain next steps (meet & greet will be scheduled)
9. Thank them and end the call

TONE:
- Warm, friendly, and conversational
- Supportive and non-judgmental
- Genuinely interested in finding the best match
- Professional but not stiff

IMPORTANT:
- This is NOT a home inspection - it's a friendly conversation
- Never use language that implies dogs are "for sale" - this is adoption/rescue
- Be encouraging about the adoption journey
- Keep responses concise and natural for phone conversation
- Listen actively and ask follow-up questions

${knowledgeBase ? `
KNOWLEDGE BASE - Use this information to answer questions about Scout and the adoption process:

${knowledgeBase}
` : ""}
${applicationQuestionsList ? `
${applicationQuestionsList}
` : ""}
Remember: Your goal is to gather information while making the adopter feel excited and supported about potentially welcoming ${dogName} into their family.`;
}

export async function initiatePhoneScreening(
  journeyId: string,
  phoneNumber: string
): Promise<{ success: boolean; callId?: string; error?: string }> {
  if (!VAPI_API_KEY) {
    return { success: false, error: "Vapi API key not configured" };
  }

  if (!VAPI_PHONE_NUMBER_ID) {
    return { success: false, error: "Vapi phone number not configured. Please set VAPI_PHONE_NUMBER_ID." };
  }

  try {
    // Get journey details
    const [journey] = await db
      .select()
      .from(adoptionJourneys)
      .where(eq(adoptionJourneys.id, journeyId));

    if (!journey) {
      return { success: false, error: "Journey not found" };
    }

    // Generate personalized prompt
    const systemPrompt = await createPhoneScreeningPrompt(
      journeyId,
      journey.dogId,
      journey.userId
    );

    // Get dog name for first message
    const [dog] = await db.select().from(dogs).where(eq(dogs.id, journey.dogId));
    const [user] = await db.select().from(users).where(eq(users.id, journey.userId));
    const dogName = dog?.name || "your potential new companion";
    const userName = user?.firstName || "there";

    // Format phone number for Vapi (E.164 format)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const e164Phone = formattedPhone.startsWith('1') ? `+${formattedPhone}` : `+1${formattedPhone}`;

    const payload: VapiCallPayload = {
      phoneNumberId: VAPI_PHONE_NUMBER_ID, // Your Vapi phone number for outbound calls
      customer: {
        number: e164Phone,
        name: userName,
      },
      assistant: {
        model: {
          provider: "openai",
          model: "gpt-4.1",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
          ],
        },
        voice: {
          provider: "11labs",
          voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - warm, friendly female voice
        },
        firstMessage: `Hi ${userName}! This is Rachel from Adopt Scout. I'm calling about your application to adopt ${dogName}. Is this still a good time to chat for a few minutes?`,
        endCallMessage: `Thank you so much for chatting with me today, ${userName}! We're really excited about your interest in ${dogName}. Someone from the team will reach out soon to schedule a meet and greet. Take care!`,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
        },
        artifactPlan: {
          recordingEnabled: false, // Don't record audio - only transcript
          transcriptPlan: {
            enabled: true,
            assistantName: "Scout",
            userName: userName,
          },
        },
      },
      metadata: {
        journeyId: journeyId,
        dogId: journey.dogId,
        userId: journey.userId,
      },
    };

    const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vapi API error:", errorText);
      return { success: false, error: `Vapi API error: ${response.status}` };
    }

    const data = (await response.json()) as VapiCallResponse;

    // Update the journey with call info
    await db
      .update(adoptionJourneys)
      .set({
        vapiCallId: data.id,
        phoneScreeningStatus: "in_progress",
        phoneScreeningScheduledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adoptionJourneys.id, journeyId));

    return { success: true, callId: data.id };
  } catch (error) {
    console.error("Error initiating phone screening:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function handleVapiWebhook(payload: any): Promise<void> {
  const { message } = payload;

  if (!message) {
    console.log("No message in webhook payload");
    return;
  }

  const callId = message.call?.id;
  const journeyId = message.call?.metadata?.journeyId;

  if (!journeyId) {
    console.log("No journeyId in webhook metadata");
    return;
  }

  console.log(`Vapi webhook received: ${message.type} for journey ${journeyId}`);

  switch (message.type) {
    case "call-started":
      await db
        .update(adoptionJourneys)
        .set({
          phoneScreeningStatus: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(adoptionJourneys.id, journeyId));
      break;

    case "call-ended":
      const transcript = message.transcript || message.call?.transcript;
      const summary = message.summary || message.call?.summary;

      // Format transcript as readable Q&A if it's an array
      let formattedTranscript = transcript;
      if (Array.isArray(transcript)) {
        formattedTranscript = transcript
          .map((msg: any) => `${msg.role === 'assistant' ? 'Scout' : 'Applicant'}: ${msg.content}`)
          .join('\n\n');
      }

      // Analyze the transcript for sentiment and insights
      let callAnalytics: CallAnalytics | null = null;
      if (formattedTranscript && typeof formattedTranscript === 'string' && formattedTranscript.length > 50) {
        try {
          callAnalytics = await analyzeCallTranscript(formattedTranscript);
          console.log(`Call analytics for journey ${journeyId}:`, callAnalytics);
        } catch (analyticsError) {
          console.error(`Failed to analyze transcript for journey ${journeyId}:`, analyticsError);
        }
      }

      // Keep currentStep at phone_screening - admin will approve transcript to move to meet_greet
      // Use phoneScreeningStatus "awaiting_review" to indicate transcript needs admin review
      // Include analytics data in the update
      await db
        .update(adoptionJourneys)
        .set({
          phoneScreeningStatus: "awaiting_review",
          phoneScreeningCompletedAt: new Date(),
          phoneScreeningTranscript: formattedTranscript,
          phoneScreeningSummary: summary,
          // Store call analytics as JSON in notes or a dedicated field
          phoneScreeningNotes: callAnalytics ? JSON.stringify({
            sentimentScore: callAnalytics.sentimentScore,
            concerningPatterns: callAnalytics.concerningPatterns,
            positiveIndicators: callAnalytics.positiveIndicators,
            recommendedFollowUp: callAnalytics.recommendedFollowUp,
            analyzedAt: new Date().toISOString()
          }) : null,
          updatedAt: new Date(),
        })
        .where(eq(adoptionJourneys.id, journeyId));

      console.log(`Phone screening completed for journey ${journeyId}. Transcript and analytics saved for admin review.`);
      break;

    case "status-update":
      if (message.status === "failed" || message.status === "no-answer") {
        await db
          .update(adoptionJourneys)
          .set({
            phoneScreeningStatus: "failed",
            updatedAt: new Date(),
          })
          .where(eq(adoptionJourneys.id, journeyId));
      }
      break;

    case "transcript":
      // Real-time transcript updates - could be used for live monitoring
      console.log("Transcript update:", message.transcript);
      break;

    default:
      console.log("Unhandled webhook type:", message.type);
  }
}

export async function getCallStatus(callId: string): Promise<VapiCallResponse | null> {
  if (!VAPI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("Error fetching call status:", response.status);
      return null;
    }

    return (await response.json()) as VapiCallResponse;
  } catch (error) {
    console.error("Error fetching call status:", error);
    return null;
  }
}

// ============================================
// FOSTER MODE CONSULTATION CALLS
// ============================================

// Create prompt for foster mode consultation
export async function createFosterConsultationPrompt(
  userId: string
): Promise<string> {
  // Fetch user profile
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));

  // Fetch user info
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  const userName = user?.firstName || "there";
  const homeType = profile?.homeType || null;
  const hasYard = profile?.hasYard;
  const hasOtherPets = profile?.hasOtherPets;
  const experienceLevel = profile?.experienceLevel || null;
  const activityLevel = profile?.activityLevel || null;
  const workSchedule = profile?.workSchedule || null;

  // Build known context
  let knownContext = "";
  if (homeType) knownContext += `- Lives in a ${homeType}\n`;
  if (hasYard !== null) knownContext += `- ${hasYard ? "Has a yard" : "No yard"}\n`;
  if (hasOtherPets !== null) knownContext += `- ${hasOtherPets ? "Has other pets" : "No other pets currently"}\n`;
  if (experienceLevel) knownContext += `- Experience: ${experienceLevel}\n`;
  if (activityLevel) knownContext += `- Activity level: ${activityLevel}\n`;
  if (workSchedule) knownContext += `- Work schedule: ${workSchedule}\n`;

  return `You are Scout, a warm and compassionate AI matchmaker for Scout Dog Adoption. You're having a friendly phone consultation with ${userName} who is interested in becoming a foster parent for dogs.

${knownContext ? `WHAT WE KNOW ABOUT ${userName.toUpperCase()}:\n${knownContext}` : ""}

YOUR GOALS:
1. Be warm, enthusiastic, and supportive about their interest in fostering
2. Explain what fostering involves and the time commitment
3. Gather essential information we need to match them with appropriate foster dogs
4. Assess their readiness and expectations for fostering
5. Answer their questions about the fostering process

ESSENTIAL INFORMATION TO GATHER:
- **Time commitment**: How long can they typically foster? (2 weeks, 1 month, 2+ months, flexible)
- **Dog size preference**: What size dogs are they comfortable fostering? (small, medium, large, any)
- **Special needs willingness**: Would they be open to fostering dogs with medical needs or behavioral challenges?
- **Emergency availability**: How quickly could they take in a dog if urgent? (same day, few days, week notice)
- **Previous fostering**: Have they fostered before? Any experience?
- **Support network**: Do they have a vet they use? Emergency backup if they need to travel?

QUESTIONS TO ASK (naturally, in conversation):
- What made you interested in fostering instead of adopting right now?
- How long do you think you could typically foster a dog? (Some need just 2 weeks, others 2+ months)
- What size dogs feel manageable for your space and lifestyle?
- Would you be open to fostering dogs with special needs - maybe medical issues or shy dogs who need confidence building?
- If we had an urgent situation - like a dog on a euthanasia list - how quickly could you take them in?
- Have you fostered animals before? What was that experience like?
- Do you have a vet you work with? What's your backup plan if you need to travel?

ADDITIONAL CONTEXT TO SHARE:
- Most shelters cover medical expenses for foster dogs
- Foster commitment is usually 2-8 weeks, but flexible by situation
- Foster families get first priority if they want to adopt their foster dog
- Foster families provide crucial socialization and information about the dog's personality

TONE:
- Enthusiastic and appreciative (fostering is amazing!)
- Warm, friendly, conversational
- Encouraging and supportive
- Professional but not formal
- Never use language implying dogs are "for sale"

CONVERSATION FLOW:
1. Warm greeting - "So excited you're interested in fostering!"
2. Share why fostering is so important
3. Ask about their availability and time commitment
4. Discuss size preferences
5. Ask about special needs willingness
6. Learn about their experience and support network
7. Answer any questions they have
8. Next steps - "We'll update your profile and start matching you with foster opportunities!"

Remember: Foster parents are heroes who save lives. Make them feel appreciated and excited about this journey!`;
}

// ============================================
// USER-INITIATED CONSULTATION CALLS
// ============================================

// Create prompt for user consultation about a specific dog
export async function createConsultationPrompt(
  userId: string,
  dogId: string
): Promise<string> {
  // Fetch dog details
  const [dog] = await db.select().from(dogs).where(eq(dogs.id, dogId));

  // Fetch user profile
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));

  // Fetch user info
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  const dogName = dog?.name || "this wonderful dog";
  const dogBreed = dog?.breed || "mixed breed";
  const dogEnergy = dog?.energyLevel || "moderate";
  const dogSize = dog?.size || "medium";
  const dogAge = dog?.ageCategory || "adult";
  const dogTemperament = dog?.temperament?.join(", ") || "friendly";
  const dogGoodWithKids = dog?.goodWithKids ? "great with children" : "may need a home without small children";
  const dogGoodWithDogs = dog?.goodWithDogs ? "friendly with other dogs" : "may prefer to be the only pet";
  const dogGoodWithCats = dog?.goodWithCats ? "good with cats" : "may not be suitable for homes with cats";
  const dogBio = dog?.bio || "";

  const userName = user?.firstName || "there";
  const homeType = profile?.homeType || null;
  const hasYard = profile?.hasYard;
  const hasOtherPets = profile?.hasOtherPets;
  const experienceLevel = profile?.experienceLevel || null;
  const activityLevel = profile?.activityLevel || null;

  // Build known context
  let knownContext = "";
  if (homeType) knownContext += `- Lives in a ${homeType}\n`;
  if (hasYard !== null) knownContext += `- ${hasYard ? "Has a yard" : "No yard"}\n`;
  if (hasOtherPets !== null) knownContext += `- ${hasOtherPets ? "Has other pets" : "No other pets currently"}\n`;
  if (experienceLevel) knownContext += `- Experience: ${experienceLevel}\n`;
  if (activityLevel) knownContext += `- Activity level: ${activityLevel}\n`;

  return `You are Scout, a warm and compassionate AI matchmaker for Scout Dog Adoption. You're having a friendly phone consultation with ${userName} who is interested in learning more about ${dogName}.

ABOUT ${dogName.toUpperCase()}:
- Breed: ${dogBreed}
- Size: ${dogSize}
- Age: ${dogAge}
- Energy Level: ${dogEnergy}
- Temperament: ${dogTemperament}
- ${dogGoodWithKids}
- ${dogGoodWithDogs}
- ${dogGoodWithCats}
${dogBio ? `- Bio: ${dogBio}` : ""}

${knownContext ? `WHAT WE KNOW ABOUT ${userName.toUpperCase()}:\n${knownContext}` : ""}

YOUR GOALS:
1. Be warm, friendly, and make them feel comfortable
2. Share wonderful details about ${dogName}'s personality
3. Learn about their lifestyle, home, and what they're looking for
4. Assess if ${dogName} would be a good match for them
5. Answer their questions enthusiastically
6. Encourage them to apply if it seems like a good match

QUESTIONS TO ASK (naturally, in conversation):
- What drew you to ${dogName}?
- Tell me about your living situation (house/apartment, yard?)
- What's your daily routine like? Work from home or away?
- Have you had dogs before? What breeds/sizes?
- Do you have other pets at home?
- Do you have children or plan to have them visit often?
- What activities would you do with your dog?
- What's most important to you in a companion?

INFORMATION TO GATHER:
- Home type and yard situation
- Work schedule and time at home
- Experience with dogs
- Current household (pets, kids)
- Activity level and lifestyle
- Preferences for size, energy, temperament
- Any concerns or questions they have

TONE:
- Enthusiastic about ${dogName}
- Warm, friendly, conversational
- Genuinely interested in finding perfect matches
- Encouraging and supportive
- NEVER use language implying dogs are "for sale"

CONVERSATION FLOW:
1. Warm greeting - "Hi! So excited to chat about ${dogName}!"
2. Share a bit about ${dogName}'s personality
3. Ask what drew them to ${dogName}
4. Natural conversation learning about their lifestyle
5. Address any concerns they have
6. If good match: Encourage them to apply!
7. Warm closing with next steps

Remember: Every piece of information you learn helps us find perfect matches. Be genuinely curious and make them feel heard!`;
}

export async function initiateConsultationCall(
  userId: string,
  dogId: string,
  phoneNumber: string
): Promise<{ success: boolean; callId?: string; error?: string }> {
  if (!VAPI_API_KEY) {
    return { success: false, error: "Vapi API key not configured" };
  }

  if (!VAPI_PHONE_NUMBER_ID) {
    return { success: false, error: "Vapi phone number not configured" };
  }

  try {
    // Generate personalized consultation prompt
    const systemPrompt = await createConsultationPrompt(userId, dogId);

    // Get dog and user info for first message
    const [dog] = await db.select().from(dogs).where(eq(dogs.id, dogId));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const dogName = dog?.name || "your potential new companion";
    const userName = user?.firstName || "there";

    // Format phone number (E.164)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const e164Phone = formattedPhone.startsWith('1') ? `+${formattedPhone}` : `+1${formattedPhone}`;

    const consultId = `consult_${Date.now()}_${userId.substring(0, 8)}`;

    const payload: VapiCallPayload = {
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: e164Phone,
        name: userName,
      },
      assistant: {
        model: {
          provider: "openai",
          model: "gpt-4.1",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
          ],
        },
        voice: {
          provider: "11labs",
          voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - warm, friendly voice
        },
        firstMessage: `Hi ${userName}! This is Scout from Scout Dog Adoption. I'm so excited to chat with you about ${dogName}! I heard you might be interested in learning more. Is this a good time?`,
        endCallMessage: `It was so wonderful chatting with you about ${dogName}, ${userName}! If you'd like to take the next step, you can apply for adoption right from ${dogName}'s profile. I really hope to hear from you soon. Take care!`,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
        },
      },
      metadata: {
        consultationId: consultId,
        dogId: dogId,
        userId: userId,
        callType: "consultation",
      },
    };

    const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vapi consultation API error:", errorText);
      return { success: false, error: `Vapi API error: ${response.status}` };
    }

    const data = (await response.json()) as VapiCallResponse;

    // Store consultation call in database
    await db.insert(consultationCalls).values({
      userId,
      dogId,
      vapiCallId: data.id,
      callType: "dog_consultation",
      status: "in_progress",
      phoneNumber: e164Phone,
      startedAt: new Date(),
    });

    console.log(`[Scout Consultation] Call initiated for user ${userId} about dog ${dogId}`);

    return { success: true, callId: data.id };
  } catch (error) {
    console.error("Error initiating consultation call:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Handle consultation call webhooks
export async function handleConsultationWebhook(payload: any): Promise<void> {
  const { message } = payload;

  if (!message) return;

  const callType = message.call?.metadata?.callType;
  if (callType !== "consultation" && callType !== "foster_consultation") return;

  const vapiCallId = message.call?.id;
  const userId = message.call?.metadata?.userId;
  const dogId = message.call?.metadata?.dogId;

  console.log(`[Scout Consultation] Webhook: ${message.type} for call ${vapiCallId}`);

  switch (message.type) {
    case "call-started":
      if (vapiCallId) {
        await db.update(consultationCalls)
          .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
          .where(eq(consultationCalls.vapiCallId, vapiCallId));
      }
      break;

    case "call-ended":
      const transcript = message.transcript || message.call?.transcript;
      const summary = message.summary || message.call?.summary;

      // Format transcript
      let formattedTranscript = transcript;
      if (Array.isArray(transcript)) {
        formattedTranscript = transcript
          .map((msg: any) => `${msg.role === 'assistant' ? 'Scout' : 'User'}: ${msg.content}`)
          .join('\n\n');
      }

      // Analyze call for sentiment
      let sentimentScore: number | null = null;
      let insights: CallAnalytics | null = null;
      if (formattedTranscript && typeof formattedTranscript === 'string' && formattedTranscript.length > 50) {
        try {
          insights = await analyzeCallTranscript(formattedTranscript);
          sentimentScore = insights.sentimentScore;
        } catch (e) {
          console.error("[Scout Consultation] Error analyzing transcript:", e);
        }
      }

      // Update database
      if (vapiCallId) {
        await db.update(consultationCalls)
          .set({
            status: "completed",
            transcript: formattedTranscript,
            summary,
            sentimentScore,
            insights: insights ? insights : null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(consultationCalls.vapiCallId, vapiCallId));
      }

      // Extract user insights from the consultation transcript
      if (formattedTranscript && userId) {
        console.log(`[Scout Consultation] Extracting insights from call for user ${userId}`);
        try {
          if (callType === "foster_consultation") {
            await extractInsightsFromMessage(
              userId,
              `Foster consultation call: ${formattedTranscript}`,
              "Insights extracted from foster consultation call"
            );
          } else {
            await extractInsightsFromMessage(
              userId,
              `Phone consultation about dog ${dogId}: ${formattedTranscript}`,
              "Insights extracted from phone consultation"
            );
          }
        } catch (error) {
          console.error("[Scout Consultation] Error extracting insights:", error);
        }
      }
      break;

    case "status-update":
      if (message.status === "failed" || message.status === "no-answer") {
        if (vapiCallId) {
          await db.update(consultationCalls)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(consultationCalls.vapiCallId, vapiCallId));
        }
      }
      break;
  }
}

// Get consultation call status from database
export async function getConsultationStatus(vapiCallId: string) {
  const [call] = await db.select()
    .from(consultationCalls)
    .where(eq(consultationCalls.vapiCallId, vapiCallId));
  return call;
}

// Initiate foster consultation call
export async function initiateFosterConsultation(
  userId: string,
  phoneNumber: string
): Promise<{ success: boolean; callId?: string; error?: string }> {
  if (!VAPI_API_KEY) {
    return { success: false, error: "Vapi API key not configured" };
  }

  if (!VAPI_PHONE_NUMBER_ID) {
    return { success: false, error: "Vapi phone number not configured" };
  }

  try {
    // Generate personalized foster consultation prompt
    const systemPrompt = await createFosterConsultationPrompt(userId);

    // Get user info for first message
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const userName = user?.firstName || "there";

    // Format phone number (E.164)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const e164Phone = formattedPhone.startsWith('1') ? `+${formattedPhone}` : `+1${formattedPhone}`;

    const consultId = `foster_consult_${Date.now()}_${userId.substring(0, 8)}`;

    const payload: VapiCallPayload = {
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: e164Phone,
        name: userName,
      },
      assistant: {
        model: {
          provider: "openai",
          model: "gpt-4.1",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
          ],
        },
        voice: {
          provider: "11labs",
          voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - warm, friendly voice
        },
        firstMessage: `Hi ${userName}! This is Scout from Scout Dog Adoption. I'm so excited to hear you're interested in fostering! This is such a wonderful way to save lives. Do you have a few minutes to chat about what fostering involves?`,
        endCallMessage: `Thank you so much for your interest in fostering, ${userName}! You're going to make such a difference. We'll update your profile and start matching you with foster opportunities. Someone from the team will reach out soon. You're amazing!`,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
        },
      },
      metadata: {
        consultationId: consultId,
        userId: userId,
        callType: "foster_consultation",
      },
    };

    const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vapi foster consultation API error:", errorText);
      return { success: false, error: `Vapi API error: ${response.status}` };
    }

    const data = (await response.json()) as VapiCallResponse;

    // Store consultation call in database
    await db.insert(consultationCalls).values({
      userId,
      dogId: null, // No specific dog for foster consultations
      vapiCallId: data.id,
      callType: "foster_consultation",
      status: "in_progress",
      phoneNumber: e164Phone,
      startedAt: new Date(),
    });

    console.log(`[Scout Foster Consultation] Call initiated for user ${userId}`);

    return { success: true, callId: data.id };
  } catch (error) {
    console.error("Error initiating foster consultation call:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// SYNC CALL STATUSES FROM VAPI API
// ============================================

export async function syncVapiCallStatuses(): Promise<{
  synced: number;
  updated: number;
  errors: string[];
}> {
  if (!VAPI_API_KEY) {
    return { synced: 0, updated: 0, errors: ["Vapi API key not configured"] };
  }

  const errors: string[] = [];
  let synced = 0;
  let updated = 0;

  try {
    // Get all in-progress calls from database
    const inProgressCalls = await db
      .select({
        id: adoptionJourneys.id,
        vapiCallId: adoptionJourneys.vapiCallId,
        status: adoptionJourneys.phoneScreeningStatus,
      })
      .from(adoptionJourneys)
      .where(
        and(
          eq(adoptionJourneys.phoneScreeningStatus, "in_progress"),
          // Only get calls that have a Vapi call ID
          // Using raw SQL to check for NOT NULL
        )
      );

    // Filter to only calls with vapiCallId
    const callsToSync = inProgressCalls.filter(c => c.vapiCallId);

    console.log(`[Vapi Sync] Found ${callsToSync.length} in-progress calls to sync`);

    for (const call of callsToSync) {
      try {
        synced++;

        // Fetch call status from Vapi API
        const response = await fetch(`${VAPI_BASE_URL}/call/${call.vapiCallId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${VAPI_API_KEY}`,
          },
        });

        if (!response.ok) {
          errors.push(`Failed to fetch call ${call.vapiCallId}: ${response.status}`);
          continue;
        }

        const vapiCall = await response.json() as any;

        console.log(`[Vapi Sync] Call ${call.vapiCallId} status: ${vapiCall.status}`);

        // Check if call is ended
        if (vapiCall.status === "ended" || vapiCall.endedAt) {
          // Get transcript and summary
          let transcript = vapiCall.transcript;
          const summary = vapiCall.summary;

          // Format transcript if it's an array
          if (Array.isArray(transcript)) {
            transcript = transcript
              .map((msg: any) => `${msg.role === 'assistant' ? 'Scout' : 'Applicant'}: ${msg.content}`)
              .join('\n\n');
          }

          // Analyze transcript if available
          let callAnalytics = null;
          if (transcript && typeof transcript === 'string' && transcript.length > 50) {
            try {
              callAnalytics = await analyzeCallTranscript(transcript);
            } catch (e) {
              console.error(`Failed to analyze transcript for call ${call.vapiCallId}:`, e);
            }
          }

          // Update the journey
          await db
            .update(adoptionJourneys)
            .set({
              phoneScreeningStatus: "awaiting_review",
              phoneScreeningCompletedAt: vapiCall.endedAt ? new Date(vapiCall.endedAt) : new Date(),
              phoneScreeningTranscript: transcript || null,
              phoneScreeningSummary: summary || null,
              phoneScreeningNotes: callAnalytics ? JSON.stringify({
                sentimentScore: callAnalytics.sentimentScore,
                concerningPatterns: callAnalytics.concerningPatterns,
                positiveIndicators: callAnalytics.positiveIndicators,
                recommendedFollowUp: callAnalytics.recommendedFollowUp,
                analyzedAt: new Date().toISOString()
              }) : null,
              updatedAt: new Date(),
            })
            .where(eq(adoptionJourneys.id, call.id));

          updated++;
          console.log(`[Vapi Sync] Updated call ${call.vapiCallId} to awaiting_review`);
        } else if (vapiCall.status === "failed" || vapiCall.status === "no-answer") {
          await db
            .update(adoptionJourneys)
            .set({
              phoneScreeningStatus: "failed",
              updatedAt: new Date(),
            })
            .where(eq(adoptionJourneys.id, call.id));

          updated++;
          console.log(`[Vapi Sync] Marked call ${call.vapiCallId} as failed`);
        }
      } catch (callError: any) {
        errors.push(`Error processing call ${call.vapiCallId}: ${callError.message}`);
      }
    }

    return { synced, updated, errors };
  } catch (error: any) {
    console.error("[Vapi Sync] Error:", error);
    return { synced, updated, errors: [...errors, error.message] };
  }
}