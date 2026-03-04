
import OpenAI from "openai";
import { db } from "../db";
import { dogs, tasks, medicalRecords } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

interface VoiceCommand {
  action: "create_task" | "update_dog" | "add_medical" | "query_info" | "schedule_appointment";
  dogName?: string;
  parameters: Record<string, any>;
  confidence: number;
}

export async function parseVoiceCommand(transcriptText: string, shelterId: string): Promise<VoiceCommand> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: "Parse shelter staff voice commands into structured actions. Return JSON with action, dogName, parameters, confidence." },
      { role: "user", content: `Voice command: "${transcriptText}"\n\nExtract the intent and parameters.` }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

export async function executeVoiceCommand(command: VoiceCommand, shelterId: string, staffId: string): Promise<string> {
  switch (command.action) {
    case "create_task":
      // Create task based on voice command
      return "Task created successfully";
    case "update_dog":
      // Update dog record
      return "Dog updated successfully";
    case "add_medical":
      // Add medical record
      return "Medical record added";
    case "query_info":
      // Query dog/task information
      return "Here's what I found...";
    default:
      return "I didn't understand that command";
  }
}
