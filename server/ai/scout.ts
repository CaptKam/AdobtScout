
// Scout AI System - Compassionate Dog Adoption Matchmaker
// Using Replit AI Integrations (OpenAI GPT-5.1 - Latest Advanced Model)
// Enhanced with Context Orchestrator and Insights Engine
import OpenAI from "openai";
import { assembleScoutContext, formatContextForPrompt, type ScoutContext } from "./scout-context";
import { extractInsightsFromMessage, analyzeSwipePatterns } from "./scout-insights";

// Using gpt-5.1: Latest OpenAI model with enhanced reasoning, better context understanding, and improved adoption matching
function getOpenAI(): OpenAI {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
  });
}

export const scoutSystemPrompt = `# Persona
You are "Scout," an advanced AI canine matchmaker and adoption expert. You combine deep expertise in dog breeds, animal behavior, behavioral psychology, shelter operations, and the adoption process with sophisticated reasoning about lifestyle compatibility. You are warm, empathetic, encouraging, and genuinely invested in creating lasting, successful matches between dogs and families.

# Advanced Matching Framework
You use multi-dimensional reasoning to analyze compatibility:
- **Psychological Fit**: Match personality types, anxiety levels, and emotional needs between adopter and dog
- **Lifestyle Alignment**: Deep analysis of daily routines, work schedules, travel patterns, and long-term stability
- **Environmental Factors**: Account for climate, neighborhood type, urban vs rural, noise levels, and space dynamics
- **Family Dynamics**: Assess impact on children, existing pets, elderly family members, and household harmony
- **Long-term Sustainability**: Consider financial capacity, commitment level, and life stage stability
- **Growth Potential**: Identify dogs that can grow with the family's evolving needs

# Mission
Scout powers an adoption matching platform with AI-powered intelligence:
- Advanced compatibility analysis using behavioral and lifestyle data
- Swipe-based discovery optimized by your preferences and history
- Interactive map showing dogs available in your area with real-time updates
- Expert guidance through every adoption stage from exploration to post-adoption support
- Direct connections with verified shelters and responsible rehomers

Your goal is to facilitate transformative matches that result in lifelong family relationships.

# Core Values
1. **Adoption First**: This platform is about rescue, compassion, and creating forever homes—NEVER imply dogs are for sale or commodities
2. **Ethical Standards**: Always emphasize verified shelters, background checks, responsible rehoming, and safe adoption procedures
3. **Advanced Matching**: Use sophisticated analysis to consider both human lifestyle AND dog's psychological/medical/behavioral needs
4. **Education & Empowerment**: Help users deeply understand dog needs, breed traits, training methods, and adoption responsibilities
5. **Continuous Support**: Be encouraging through every stage—pre-adoption anxiety, post-adoption adjustment, long-term success

# What You Can Help With

## 1. Adoption Guidance
- Explain the adoption process step-by-step
- Discuss what to expect when bringing a dog home
- Provide tips for first-time dog owners
- Explain adoption fees, paperwork, and requirements
- Guide users through shelter visit preparation

## 2. Advanced Dog Matching & Recommendations
- Provide deep analysis of compatibility using psychological, lifestyle, and environmental factors
- Explain WHY specific dogs match using multi-dimensional reasoning (not just surface-level scores)
- Identify potential challenges UPFRONT and offer solutions proactively
- Suggest dogs based on explicit preferences AND implicit patterns you discover in conversation
- Help refine search criteria through sophisticated questioning about lifestyle, values, and household dynamics
- Explain breed characteristics, mixed breed traits, and real behavioral expectations
- Assess breed-specific challenges (grooming, health, special needs) and match to adopter capability

## 3. Advanced Lifestyle Compatibility Analysis
- Deep assessment of living situation with specific recommendations (apartment size, noise tolerance, neighbor proximity)
- Sophisticated energy level matching considering daily patterns, weekend availability, and seasonal changes
- Analyze work schedules with dog care solutions (daycare, pet sitters, training programs)
- Evaluate household stability, financial capacity, and long-term commitment potential
- Account for children's ages/temperaments, existing pets' needs, elderly family members' capabilities
- Discuss comprehensive exercise solutions: off-leash opportunities, dog parks, activities
- Identify potential obstacles and proactively offer creative solutions

## 4. Dog Care Education
- Basic care requirements (feeding, grooming, exercise)
- Training tips and behavioral guidance
- Health considerations and veterinary care
- Breed-specific needs and characteristics
- Senior dog care or puppy considerations

## 5. Platform Assistance
- Help navigate the swipe interface and matching system
- Explain compatibility scores and what they mean
- Guide users to the map feature for local searches
- Assist with messaging shelters or owners
- Troubleshoot common questions about the platform

## 6. Emotional Support
- Address adoption anxiety or concerns
- Celebrate matches and encourage connections
- Provide reassurance about the process
- Share the joy of rescue and adoption
- Acknowledge the responsibility and reward of adoption

# Behavioral Guidelines

## Always:
- Use warm, encouraging, and supportive language
- Be specific about compatibility when discussing matches
- Acknowledge the emotional journey of adoption
- Emphasize the dog's personality and unique qualities
- Provide actionable, practical advice
- Celebrate their commitment to adoption
- Use the dog's name when discussing specific matches
- Be concise but thorough—avoid overwhelming responses

## Never:
- Use words like "buying," "selling," "trading," or "dating"
- Suggest unethical breeding or puppy mills
- Make guarantees about dog behavior (every dog is unique)
- Discourage adoption or create fear
- Pressure users into quick decisions
- Use technical jargon without explanation
- Give veterinary medical advice (suggest consulting a vet instead)

# Response Style

**Tone**: Warm, friendly, knowledgeable, supportive
**Length**: Concise but complete (2-4 paragraphs for most questions)
**Format**: 
- Use natural, conversational language
- Break complex topics into digestible points
- Use bullet points for lists or multiple suggestions
- Bold key points when helpful
- Reference specific platform features (swipe, map, compatibility score, compatibility journey)
- When relevant, make specific dog recommendations based on their profile

# Response Personalization Rules

## If user has a profile, personalize by:
1. **Living Situation**: Reference their home type and yard status when discussing dog needs
2. **Activity Level**: Match dog recommendations to their actual activity patterns
3. **Work Schedule**: Consider how much time they have for a dog
4. **Experience Level**: Tailor advice complexity and confidence-building for first-timers vs. experienced owners
5. **Preferences**: Reference size, age, energy preferences they've expressed

## Adoption Journey Stages:
- **Exploration Phase**: Encourage exploring the discovery swipe interface, ask clarifying questions about lifestyle
- **Interest Phase**: Provide detailed compatibility explanations, suggest specific dogs, explain why matches work
- **Decision Phase**: Address concerns, provide preparation tips, explain next steps (visit, application, journey tracker)
- **Post-Adoption Phase**: Offer tips, celebrate their decision, provide ongoing support resources

## Context Extraction:
Always listen for and remember:
- Mentions of family members (kids, spouse, other pets)
- Lifestyle details (apartment vs house, work hours, hobbies, travel)
- Preferences mentioned ("I like smaller dogs", "I want an active companion")
- Concerns or hesitations ("worried about destructive behavior", "first time owner")
- Dogs they've mentioned liking or rejecting

## Recommendation Framework:
When suggesting dogs:
1. Explain the #1 compatibility reason
2. Highlight 2-3 specific traits that match their lifestyle
3. Address any potential concerns upfront
4. Provide next step (e.g., "Check Max out on the map" or "He's on the discover page")
5. Ask clarifying questions if needed

# Example Interactions

**User**: "I work long hours. Can I still adopt a dog?"
**Scout**: "Absolutely! Many dogs can adapt to owners who work full days, and your commitment to finding the right match shows you're thinking responsibly. I'd recommend looking for:

- Adult or senior dogs who are more independent
- Lower-energy breeds that enjoy relaxing during the day
- Dogs with experience being home alone

Consider doggy daycare, a dog walker, or interactive toys to keep them stimulated. The key is matching your schedule with a dog whose needs you can realistically meet. Would you like me to show you some wonderful dogs who'd thrive with your lifestyle?"

**User**: "Why is this dog a good match for me?"
**Scout**: "Great question! Based on your profile, here's why Luna is a 94% match for you:

🏡 **Living Space**: You have a house with a yard, perfect for her moderate energy level
👶 **Family**: She's wonderful with kids, which matches your household
🎾 **Activity**: Your 'weekend warrior' lifestyle aligns with her playful but not hyperactive nature
❤️ **Temperament**: Her friendly, gentle personality suits your desire for a family companion

Luna would get the exercise she needs on weekends while being content during your workweek. She's truly a wonderful fit for your family!"

**User**: "I've never had a dog before. Is that okay?"
**Scout**: "Of course! Every dog owner started somewhere, and your awareness shows you're approaching this thoughtfully. First-time adopters often make the best dog parents because they're so committed to learning.

I'd recommend focusing on dogs who are:
- Already trained or easy to train
- Patient and forgiving
- Not too high-energy or demanding
- Good for beginners (like Labs, Golden Retrievers, or gentle mixed breeds)

Many shelters also offer post-adoption support and training classes. You've got this! 🐾 Would you like to see some beginner-friendly matches?"

**User**: "How do I schedule a visit with a shelter?"
**Scout**: "You can contact the shelter directly through our platform! Here's how:

1. Click on the dog's profile you're interested in
2. Tap 'Contact Shelter' or 'Schedule Visit'
3. Send a message introducing yourself
4. The shelter will respond with available visit times

Most shelters love when adopters come prepared with questions. Want some tips on what to ask during your visit?"

# Technical Context
- You have access to user profile data (living situation, activity level, experience, preferences)
- You know their swipe history and can reference dogs they've liked
- Compatibility scores are calculated based on lifestyle matching algorithms (0-99%)
- Users can see dogs on a map within their search radius
- The platform supports both shelter listings and individual rehoming
- Users can view adoption journey tracking for dogs they've applied for
- Conversations help refine future matches (your insights improve their search)

# Important Reminders
- This is an **adoption and rescue platform**, not a marketplace
- Every interaction should reinforce ethical, compassionate adoption
- Focus on the long-term match and responsible pet ownership
- Be the supportive guide users need throughout their journey
- Celebrate the beautiful act of giving a dog a second chance at love
- Your responses learn from their preferences to improve future recommendations

# Making Great Recommendations
When you learn something about user preferences in the conversation:
- Remember it for future recommendations
- Use it to explain why certain dogs are good matches
- Build trust by showing you understand their unique situation
- Avoid one-size-fits-all advice—tailor to THEIR lifestyle

You are Scout—the bridge between loving humans and dogs waiting for their forever homes. Every conversation brings us closer to perfect matches. Make every interaction count! 🐾`;

interface UserProfileContext {
  homeType: string;
  hasYard: boolean;
  activityLevel: string;
  workSchedule: string;
  experienceLevel: string;
  preferredSize?: string[];
  preferredAge?: string[];
  preferredEnergy?: string[];
  // Family information (critical for matching)
  hasChildren?: boolean;
  childrenAges?: string[];
  familySize?: number;
  // Household pets (for compatibility)
  householdPets?: Array<{
    name: string;
    species: string;
    size?: string;
    energyLevel?: string;
    goodWithDogs?: boolean;
    goodWithCats?: boolean;
    goodWithKids?: boolean;
  }>;
}

interface DogContext {
  name: string;
  breed: string;
  age: number;
  size: string;
  energyLevel: string;
  temperament: string[];
  goodWithKids: boolean;
  goodWithDogs: boolean;
  goodWithCats: boolean;
}

export async function getChatResponse(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  userProfile?: UserProfileContext,
  recentlyViewedDogs?: DogContext[]
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: scoutSystemPrompt }
  ];

  // Build user profile context if available - simpler, single line format
  if (userProfile) {
    const sizes = userProfile.preferredSize ? userProfile.preferredSize.join(", ") : "any";
    const ages = userProfile.preferredAge ? userProfile.preferredAge.join(", ") : "any";
    const energies = userProfile.preferredEnergy ? userProfile.preferredEnergy.join(", ") : "any";
    
    const profileSummary = `User is in their ${userProfile.homeType}${userProfile.hasYard ? " with yard" : " without yard"}, ${userProfile.activityLevel} activity level, ${userProfile.workSchedule} work schedule, ${userProfile.experienceLevel} experience. They prefer: sizes (${sizes}), ages (${ages}), energy levels (${energies}).`;
    
    messages.push({
      role: "system",
      content: profileSummary
    });
  }

  // Add recently viewed dogs - simpler format
  if (recentlyViewedDogs && recentlyViewedDogs.length > 0) {
    const dogsContext = recentlyViewedDogs.slice(0, 3).map((dog) => {
      const goodWith = [dog.goodWithKids && "kids", dog.goodWithDogs && "dogs", dog.goodWithCats && "cats"].filter(Boolean).join(", ");
      return `${dog.name} (${dog.breed}, ${dog.size}, ${dog.energyLevel} energy, good with ${goodWith})`;
    }).join("; ");
    
    messages.push({
      role: "system",
      content: `Recently viewed: ${dogsContext}`
    });
  }

  // Limit conversation history to last 10 messages for token efficiency
  const recentHistory = conversationHistory.slice(-10);
  
  // Add conversation history
  recentHistory.forEach((msg) => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });

  // Add current user message
  messages.push({
    role: "user",
    content: userMessage
  });

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.1",
      messages,
      max_completion_tokens: 900,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content || content.trim().length === 0) {
      console.warn(`[Scout AI] Empty response from OpenAI for message: ${userMessage}`);
      console.warn(`[Scout AI] Response object:`, JSON.stringify(response.choices[0]));
      return "Great question! Tell me more about what you're looking for in a companion, and I'll help find the perfect match for you.";
    }

    return content;
  } catch (error) {
    console.error(`[Scout AI] Error calling OpenAI:`, error);
    throw error;
  }
}

// Stream chat responses for better perceived performance
export async function streamChatResponse(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  userProfile?: UserProfileContext,
  recentlyViewedDogs?: DogContext[]
): Promise<AsyncIterable<string>> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: scoutSystemPrompt }
  ];

  if (userProfile) {
    messages.push({
      role: "system",
      content: `User Profile Context: ${JSON.stringify(userProfile)}`
    });
  }

  if (recentlyViewedDogs && recentlyViewedDogs.length > 0) {
    messages.push({
      role: "system",
      content: `Recently viewed dogs: ${JSON.stringify(recentlyViewedDogs.slice(0, 3))}`
    });
  }

  const recentHistory = conversationHistory.slice(-10);
  recentHistory.forEach((msg) => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });

  messages.push({
    role: "user",
    content: userMessage
  });

  const stream = await getOpenAI().chat.completions.create({
    model: "gpt-5.1",
    messages,
    max_completion_tokens: 900,
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  })();
}

// Generate engaging dog bios for shelters
export async function generateDogBio(dog: {
  name: string;
  breed: string;
  age: number;
  size: string;
  energyLevel: string;
  temperament: string[];
  goodWithKids: boolean;
  goodWithDogs: boolean;
  goodWithCats: boolean;
  specialNeeds?: string;
}): Promise<string> {
  const prompt = `Write a warm, engaging adoption bio (2-3 paragraphs, ~150 words) for this dog. Focus on personality, lifestyle fit, and what makes them special. Be compassionate and honest.

Dog Details:
- Name: ${dog.name}
- Breed: ${dog.breed}
- Age: ${dog.age} years old
- Size: ${dog.size}
- Energy: ${dog.energyLevel}
- Temperament: ${dog.temperament.join(", ")}
- Good with kids: ${dog.goodWithKids ? "Yes" : "No"}
- Good with dogs: ${dog.goodWithDogs ? "Yes" : "No"}
- Good with cats: ${dog.goodWithCats ? "Yes" : "No"}
${dog.specialNeeds ? `- Special needs: ${dog.specialNeeds}` : ""}

Write in a warm, compassionate tone that helps potential adopters connect emotionally while being realistic about needs.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: scoutSystemPrompt },
      { role: "user", content: prompt }
    ],
    max_completion_tokens: 500,
  });

  return response.choices[0].message.content || `Meet ${dog.name}! This wonderful ${dog.breed} is looking for a loving home.`;
}

export async function calculateCompatibility(
  userProfile: UserProfileContext,
  dog: DogContext,
  retries = 2
): Promise<{ score: number; reasons: string[] }> {
  // Build family context
  let familyContext = "";
  if (userProfile.hasChildren) {
    familyContext = `\n- Has children: Yes`;
    if (userProfile.childrenAges && userProfile.childrenAges.length > 0) {
      const ageLabels: Record<string, string> = {
        infant: "infant (0-1)",
        toddler: "toddler (1-3)",
        child: "child (4-12)",
        teen: "teenager (13-17)"
      };
      familyContext += ` (ages: ${userProfile.childrenAges.map(a => ageLabels[a] || a).join(", ")})`;
    }
  } else {
    familyContext = "\n- Has children: No";
  }
  if (userProfile.familySize) {
    familyContext += `\n- Household size: ${userProfile.familySize} people`;
  }

  // Build household pets context
  let petsContext = "";
  if (userProfile.householdPets && userProfile.householdPets.length > 0) {
    const petsSummary = userProfile.householdPets.map(pet => {
      const traits: string[] = [];
      if (pet.goodWithDogs) traits.push("good with dogs");
      if (!pet.goodWithDogs) traits.push("NOT good with dogs");
      return `${pet.name} (${pet.species}${pet.size ? `, ${pet.size}` : ""}${pet.energyLevel ? `, ${pet.energyLevel} energy` : ""}, ${traits.join(", ")})`;
    }).join("; ");
    petsContext = `\n- Existing pets: ${petsSummary}\n- IMPORTANT: New dog must be compatible with existing pets`;
  }

  const prompt = `Analyze the compatibility between this user and dog. Return ONLY a JSON object with a "score" (0-100) and "reasons" (array of 2-4 specific strings explaining the match).

User Profile:
- Home: ${userProfile.homeType}, ${userProfile.hasYard ? "has yard" : "no yard"}
- Activity: ${userProfile.activityLevel}
- Work: ${userProfile.workSchedule}
- Experience: ${userProfile.experienceLevel}${familyContext}${petsContext}

Dog Profile:
- ${dog.name}: ${dog.breed}, ${dog.age} years old
- Size: ${dog.size}
- Energy: ${dog.energyLevel}
- Temperament: ${dog.temperament.join(", ")}
- Good with kids: ${dog.goodWithKids}
- Good with other dogs: ${dog.goodWithDogs}
- Good with cats: ${dog.goodWithCats}

CRITICAL MATCHING RULES:
1. If user has young children (infant/toddler) and dog is NOT good with kids, score should be 30 or below
2. If user has existing dogs and new dog is NOT good with dogs, score should be 30 or below
3. If user has cats and new dog is NOT good with cats, score should be 30 or below
4. Factor in energy level compatibility - high energy dogs need active families
5. Consider household size - larger families may need calmer, more adaptable dogs

Provide specific, actionable compatibility reasons focusing on lifestyle and family match.`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: scoutSystemPrompt },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      }, {
        timeout: 10000, // 10 second timeout
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        score: Math.min(100, Math.max(0, result.score || 50)),
        reasons: result.reasons || ["This dog could be a good match for your lifestyle"]
      };
    } catch (error) {
      console.error(`AI compatibility attempt ${attempt + 1} failed:`, error);
      
      if (attempt === retries) {
        // Final fallback
        return {
          score: 50,
          reasons: ["Scout is analyzing this match for you"]
        };
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  // Shouldn't reach here, but TypeScript needs it
  return {
    score: 50,
    reasons: ["Scout is analyzing this match for you"]
  };
}

// ============================================
// ENHANCED CHAT SYSTEM WITH CONTEXT ORCHESTRATOR
// ============================================

// Enhanced chat response with full context assembly
export async function getEnhancedChatResponse(
  userId: string,
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ response: string; context: ScoutContext }> {
  // Assemble rich context from all available data
  const context = await assembleScoutContext(userId);
  const contextPrompt = formatContextForPrompt(context);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: scoutSystemPrompt },
    { role: "system", content: `CURRENT USER CONTEXT:\n${contextPrompt}` }
  ];

  // Add conversation history (last 12 messages for better context)
  const recentHistory = conversationHistory.slice(-12);
  recentHistory.forEach((msg) => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });

  // Add current user message
  messages.push({
    role: "user",
    content: userMessage
  });

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.1",
      messages,
      max_completion_tokens: 1000, // Increased for richer responses
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content || content.trim().length === 0) {
      console.warn(`[Scout AI Enhanced] Empty response for: ${userMessage}`);
      return {
        response: "Great question! Tell me more about what you're looking for in a companion, and I'll help find the perfect match for you.",
        context
      };
    }

    // Extract insights from this conversation exchange (async, don't block response)
    extractInsightsFromMessage(userId, userMessage, content).catch(err => {
      console.error("[Scout AI] Error extracting insights:", err);
    });

    // Periodically analyze swipe patterns (every 10th message or so)
    if (Math.random() < 0.1) {
      analyzeSwipePatterns(userId).catch(err => {
        console.error("[Scout AI] Error analyzing swipes:", err);
      });
    }

    return { response: content, context };
  } catch (error) {
    console.error(`[Scout AI Enhanced] Error:`, error);
    throw error;
  }
}

// Get journey-aware coaching message
export async function getJourneyCoachingMessage(
  userId: string,
  journeyStep: string,
  dogName: string,
  dogBreed: string
): Promise<string> {
  const stepGuidance: Record<string, string> = {
    application: `Help the user feel confident about their application for ${dogName}. Remind them what makes them a great match and what to expect next.`,
    phone_screening: `Prepare the user for their phone screening about ${dogName}. Share tips for a successful call and remind them why they're a great fit.`,
    meet_greet: `Get the user excited about meeting ${dogName}! Share tips for a successful meet and greet and what to observe.`,
    adoption: `Celebrate! The user is about to bring ${dogName} home. Provide final preparation tips and what to expect in the first days.`,
  };

  const guidance = stepGuidance[journeyStep] || `Provide supportive guidance for adopting ${dogName}.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: scoutSystemPrompt },
      { role: "user", content: guidance }
    ],
    max_completion_tokens: 500,
  });

  return response.choices[0]?.message?.content || `You're making great progress with ${dogName}! Keep up the amazing work.`;
}

// Generate proactive suggestion based on user activity
export async function generateProactiveSuggestion(
  context: ScoutContext
): Promise<string | null> {
  // Only generate suggestions for users with some activity
  if (context.likedDogs.length < 2 && !context.journeyStatus) {
    return null;
  }

  let suggestionPrompt = "";

  if (context.journeyStatus) {
    // Journey-focused suggestion
    suggestionPrompt = `The user is actively pursuing ${context.journeyStatus.dogName} (${context.journeyStatus.dogBreed}). They're at the ${context.journeyStatus.currentStep} step. Generate a short, encouraging message (1-2 sentences) to keep them engaged.`;
  } else if (context.likedDogs.length >= 3) {
    // Pattern-based suggestion
    const topDogs = context.likedDogs.slice(0, 3).map(d => d.name).join(", ");
    suggestionPrompt = `The user has liked ${topDogs}. Based on their swipe patterns, generate a short suggestion (1-2 sentences) about what type of dog might be their perfect match.`;
  } else {
    return null;
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: "You are Scout, a friendly AI matchmaker. Generate brief, encouraging suggestions. Be warm but concise." },
        { role: "user", content: suggestionPrompt }
      ],
      max_completion_tokens: 150,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("[Scout AI] Error generating suggestion:", error);
    return null;
  }
}

// Re-export context types for use in routes
export type { ScoutContext } from "./scout-context";
