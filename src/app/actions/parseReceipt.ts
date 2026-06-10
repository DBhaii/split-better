"use server";

// Use require to avoid TypeScript resolution errors when types for @google/genai are not installed
// @ts-ignore
const { GoogleGenAI } = require("@google/genai");

// Initialize the official Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ParsedLineItem {
  name: string;
  price: number;
}

interface ReceiptData {
  merchant: string;
  totalAmount: number;
  items: ParsedLineItem[];
}

export async function parseReceiptAction(formData: FormData): Promise<ReceiptData> {
  const file = formData.get("receipt") as File;
  if (!file || file.size === 0) {
    throw new Error("No file uploaded");
  }

  // Convert file to base64 for Gemini payload data
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64Image = buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Image,
          },
        },
        "Analyze this receipt image. Extract the merchant name, the final total amount, and every individual itemized line item with its respective price. Ensure the item prices sum up to match or closely approximate the total amount before taxes/fees.",
      ],
      config: {
        // Enforce structured JSON output matching our interface precisely
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            merchant: { type: "STRING" },
            totalAmount: { type: "NUMBER" },
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  price: { type: "NUMBER" },
                },
                required: ["name", "price"],
              },
            },
          },
          required: ["merchant", "totalAmount", "items"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Empty response from AI engine");
    }

    return JSON.parse(response.text) as ReceiptData;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw new Error("Failed to read receipt data correctly.");
  }
}