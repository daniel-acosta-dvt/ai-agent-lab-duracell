import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedPriceUpdate, MissingField } from '../types';

// Initialize the SDK. It expects process.env.API_KEY to be available in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

export const extractPricingData = async (
  emailContent: string,
  userCompany: string
): Promise<ExtractedPriceUpdate[]> => {
  const prompt = `
    You are an expert data extraction assistant working for ${userCompany}.
    Analyze the following incoming supplier email and extract pricing updates.
    
    Crucial Instructions:
    1. Normalize material names: Add spaces between words and letters if they are missing (e.g., convert "MaterialA" to "Material A").
    2. Extract the new price, currency, PER (e.g., 1, 100, 1000), and UOM (Unit of Measure, e.g., MT, KG, PC) from strings like "1000€/MT" (Price: 1000, Currency: €, PER: 1, UOM: MT).
    3. Extract the Validity Start Date. If a period is mentioned (e.g., "H1'26"), convert it to a standard start date format (e.g., "01/01/2026").
    4. STRICT RULE: Si no tienes información, no la inventes. (If you do not have information for a specific field, DO NOT invent or guess it. Return an empty string).
    
    Email Content:
    """
    ${emailContent}
    """
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'List of extracted pricing updates',
          items: {
            type: Type.OBJECT,
            properties: {
              normalizedMaterialName: {
                type: Type.STRING,
                description: 'The normalized name of the material (e.g., "Material A").'
              },
              price: {
                type: Type.NUMBER,
                description: 'The numerical value of the new price.'
              },
              currency: {
                type: Type.STRING,
                description: 'The currency code or symbol (e.g., "EUR", "€", "USD").'
              },
              per: {
                type: Type.STRING,
                description: 'The pricing unit quantity (e.g., "1", "100", "1000"). Default to "1" if implied.'
              },
              uom: {
                type: Type.STRING,
                description: 'The Unit of Measure (e.g., "MT", "KG", "PC").'
              },
              validityStartDate: {
                type: Type.STRING,
                description: 'The start date for the new price (e.g., "01/01/2026").'
              },
              supplierName: {
                type: Type.STRING,
                description: 'The name of the supplier sending the email. Leave empty if not found.'
              }
            },
            required: ['normalizedMaterialName', 'price', 'currency']
          }
        }
      }
    });

    const jsonStr = response.text.trim();
    if (!jsonStr) {
      return [];
    }
    
    const parsedData = JSON.parse(jsonStr) as ExtractedPriceUpdate[];
    return parsedData;
  } catch (error) {
    console.error("Error extracting data with Gemini:", error);
    throw new Error("Failed to process email content.");
  }
};

export const parseUserCorrection = async (
  userMessage: string,
  pendingField: MissingField
): Promise<string> => {
  const prompt = `
    You are an intent parsing assistant.
    The user was asked to provide the value for '${pendingField.description}' for the item '${pendingField.itemName}'.
    ${pendingField.suggestion ? `The suggested value was '${pendingField.suggestion}'.` : ''}
    
    The user replied: "${userMessage}"
    
    Task: Extract the final intended value based on the user's reply.
    - If they agreed with the suggestion (e.g., "yes", "correct", "use that"), return the suggested value exactly.
    - If they provided a new value, extract and return ONLY that new value.
    - If they say they don't know or to leave it blank, return an empty string.
    
    Return ONLY the final string value. Do not include any other text, markdown, or explanation.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error parsing user correction with Gemini:", error);
    throw new Error("Failed to parse user response.");
  }
};
