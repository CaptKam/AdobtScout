
// Document Intelligence - OCR + AI extraction for adoption documents
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface DocumentExtractionResult {
  documentType: string;
  isValid: boolean;
  confidence: number;
  extractedData: Record<string, any>;
  concerns: string[];
  verificationStatus: "verified" | "needs_review" | "invalid";
}

// Extract text from image using GPT-5's vision capabilities
export async function extractTextFromDocument(
  imageBase64: string,
  documentType: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all visible text from this ${documentType} document. Return the raw text exactly as it appears, preserving formatting and layout where possible.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_completion_tokens: 1000,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error extracting text from document:", error);
    throw new Error("Failed to extract text from document");
  }
}

// Process and extract structured data from government ID
export async function processGovernmentID(
  imageBase64: string
): Promise<DocumentExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a document verification specialist. Extract information from government-issued IDs (driver's license, passport, state ID, etc.) and verify authenticity indicators.

Return a JSON object with:
- documentType: type of ID (e.g., "Driver's License", "Passport")
- isValid: boolean indicating if this appears to be a legitimate government ID
- confidence: 0-100 score of extraction confidence
- extractedData: object with fields like fullName, address, dateOfBirth, idNumber, expirationDate, issuingState
- concerns: array of any red flags or issues noticed
- verificationStatus: "verified", "needs_review", or "invalid"`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this government ID and extract all relevant information. Pay attention to security features, formatting, and any signs of tampering."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      documentType: result.documentType || "Unknown ID",
      isValid: result.isValid ?? false,
      confidence: result.confidence || 0,
      extractedData: result.extractedData || {},
      concerns: result.concerns || [],
      verificationStatus: result.verificationStatus || "needs_review"
    };
  } catch (error) {
    console.error("Error processing government ID:", error);
    return {
      documentType: "Unknown",
      isValid: false,
      confidence: 0,
      extractedData: {},
      concerns: ["Automatic processing failed"],
      verificationStatus: "needs_review"
    };
  }
}

// Process proof of residence document
export async function processProofOfResidence(
  imageBase64: string
): Promise<DocumentExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a document verification specialist. Extract information from proof of residence documents (utility bills, lease agreements, bank statements, etc.).

Return a JSON object with:
- documentType: type of document (e.g., "Utility Bill", "Lease Agreement")
- isValid: boolean indicating if this is a valid proof of residence
- confidence: 0-100 score
- extractedData: object with address, residentName, documentDate, issuer
- concerns: array of issues
- verificationStatus: "verified", "needs_review", or "invalid"`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this proof of residence document. Verify it's recent (within 90 days) and matches expected formatting."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      documentType: result.documentType || "Proof of Residence",
      isValid: result.isValid ?? false,
      confidence: result.confidence || 0,
      extractedData: result.extractedData || {},
      concerns: result.concerns || [],
      verificationStatus: result.verificationStatus || "needs_review"
    };
  } catch (error) {
    console.error("Error processing proof of residence:", error);
    return {
      documentType: "Proof of Residence",
      isValid: false,
      confidence: 0,
      extractedData: {},
      concerns: ["Automatic processing failed"],
      verificationStatus: "needs_review"
    };
  }
}

// Process veterinary reference letter
export async function processVetReference(
  imageBase64: string
): Promise<DocumentExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a document verification specialist. Extract information from veterinary reference letters.

Return a JSON object with:
- documentType: always "Veterinary Reference"
- isValid: boolean
- confidence: 0-100 score
- extractedData: object with vetName, clinicName, phone, email, patientHistory, recommendations
- concerns: array of issues
- verificationStatus: "verified", "needs_review", or "invalid"`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this veterinary reference letter. Extract vet contact information and any notes about the applicant's pet care history."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      documentType: "Veterinary Reference",
      isValid: result.isValid ?? false,
      confidence: result.confidence || 0,
      extractedData: result.extractedData || {},
      concerns: result.concerns || [],
      verificationStatus: result.verificationStatus || "needs_review"
    };
  } catch (error) {
    console.error("Error processing vet reference:", error);
    return {
      documentType: "Veterinary Reference",
      isValid: false,
      confidence: 0,
      extractedData: {},
      concerns: ["Automatic processing failed"],
      verificationStatus: "needs_review"
    };
  }
}

// Universal document processor - automatically detects type
export async function processDocument(
  imageBase64: string,
  expectedType?: string
): Promise<DocumentExtractionResult> {
  // If type is specified, use specialized processor
  if (expectedType) {
    switch (expectedType.toLowerCase()) {
      case "id":
      case "driver_license":
      case "passport":
        return processGovernmentID(imageBase64);
      case "proof_of_residence":
      case "utility_bill":
      case "lease":
        return processProofOfResidence(imageBase64);
      case "vet_reference":
        return processVetReference(imageBase64);
    }
  }

  // Auto-detect document type
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `Identify the type of document in this image and extract all relevant information.

Possible document types:
- Government ID (driver's license, passport, state ID)
- Proof of Residence (utility bill, lease agreement, bank statement)
- Veterinary Reference
- Other

Return a JSON object following the standard format.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Identify and process this document."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      documentType: result.documentType || "Unknown Document",
      isValid: result.isValid ?? false,
      confidence: result.confidence || 0,
      extractedData: result.extractedData || {},
      concerns: result.concerns || [],
      verificationStatus: result.verificationStatus || "needs_review"
    };
  } catch (error) {
    console.error("Error processing document:", error);
    return {
      documentType: "Unknown",
      isValid: false,
      confidence: 0,
      extractedData: {},
      concerns: ["Automatic processing failed"],
      verificationStatus: "needs_review"
    };
  }
}
