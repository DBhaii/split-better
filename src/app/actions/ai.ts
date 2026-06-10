"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function scanReceiptWithAI(formData: FormData) {
  const file = formData.get("receipt") as File;
  if (!file) throw new Error("No file uploaded");

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in your .env file");
  }

  // Convert the file into a base64 buffer for the AI
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString("base64");

  // Initialize the Gemini 1.5 Flash model (optimized for fast vision tasks)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Analyze this receipt image. Extract the name of the establishment and the final total amount. 
    Format the description nicely, for example: 'Dinner at [Establishment Name]' or 'Groceries from [Store Name]'.
    
    You MUST return strictly a JSON object with exactly these two keys. No markdown, no code blocks, just raw JSON:
    {"description": "string", "amount": number}
  `;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      }
    ]);

    // Clean the response text to ensure perfectly parseable JSON
    let responseText = result.response.text().trim();
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(responseText);
  } catch (error) {
    console.error("AI Parse Error:", error);
    throw new Error("Failed to read the receipt. Please try a clearer image.");
  }
}