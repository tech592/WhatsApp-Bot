import { GoogleGenAI, Type } from '@google/genai';
import { GEMINI_API_KEY } from '../config/secrets';
import { GeminiVerificationResponse } from '../types';

export class GeminiService {
  private static getClient() {
    return new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
  }

  static async verifyEODMatch(eodText: string, sheetRowText: string): Promise<GeminiVerificationResponse> {
    const ai = this.getClient();

    const prompt = `
You are an AI assistant verifying employee end-of-day (EOD) reports against their morning To-Do list.
You are given the raw WhatsApp EOD text sent by the employee, and the corresponding row text from their To-Do Google Sheet.

EOD Text: "${eodText}"
To-Do Sheet Row: "${sheetRowText}"

Compare the completed tasks mentioned in the EOD Text with the planned tasks in the To-Do Sheet.
Determine if there is a discrepancy (e.g., a task was planned but not mentioned as completed, or explicitly mentioned as not completed).
Return a JSON object with:
- "match": boolean (true if all tasks match perfectly, false if there is a discrepancy or missing task)
- "discrepancyReason": string (If match is false, state the exact discrepancy in 1-2 sentences. If match is true, return empty string "")
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              match: {
                type: Type.BOOLEAN,
                description: "True if EOD matches To-Do tasks, false otherwise.",
              },
              discrepancyReason: {
                type: Type.STRING,
                description: "Reason for discrepancy if match is false.",
              },
            },
            required: ["match", "discrepancyReason"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from Gemini");
      }

      const result: GeminiVerificationResponse = JSON.parse(responseText);
      return result;
    } catch (error) {
      console.error("Error in Gemini verifyEODMatch:", error);
      // In case of error (timeout/rate limit), default to assuming a match or manual review needed
      // To prevent false alarms
      return { match: true, discrepancyReason: "Verification failed due to error, assumed match." };
    }
  }
}
