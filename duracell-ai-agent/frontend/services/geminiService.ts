import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedPriceUpdate, MissingField, ProcessedRecord } from '../types';

export const EDITABLE_FIELDS = [
  'saOaRecord', 'vendorName', 'vendorCode', 'saLine', 'brandCode',
  'brandDescription', 'previousPrice', 'newPrice', 'validityStartDate',
  'validityEndDate', 'currency', 'per', 'uom', 'buyerCode', 'comments'
] as const;
export type EditableField = typeof EDITABLE_FIELDS[number];

export interface RecordEdit {
  recordId: string;
  fieldName: EditableField;
  value: string;
}

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

export const parseRecordEdits = async (
  userMessage: string,
  records: ProcessedRecord[]
): Promise<RecordEdit[]> => {
  const summary = records.map((r, i) => ({
    rowNumber: i + 1,
    recordId: r.id,
    material: r.shortText || r.brandDescription || '(unknown)',
    brandCode: r.brandCode,
    vendorName: r.vendorName,
    currentValues: {
      saOaRecord: r.saOaRecord,
      vendorName: r.vendorName,
      vendorCode: r.vendorCode,
      saLine: r.saLine,
      brandCode: r.brandCode,
      brandDescription: r.brandDescription,
      previousPrice: r.previousPrice,
      newPrice: r.newPrice,
      validityStartDate: r.validityStartDate,
      validityEndDate: r.validityEndDate,
      currency: r.currency,
      per: r.per,
      uom: r.uom,
      buyerCode: r.buyerCode,
      comments: r.comments,
    }
  }));

  const prompt = `
    You translate a user's natural-language edit request into structured updates
    on a price-change request form. The form has one or more rows. Each row
    represents a material with these editable fields:
      saOaRecord, vendorName, vendorCode, saLine, brandCode, brandDescription,
      previousPrice, newPrice, validityStartDate, validityEndDate, currency,
      per, uom, buyerCode, comments.

    Current rows (JSON):
    ${JSON.stringify(summary, null, 2)}

    User instruction:
    """
    ${userMessage}
    """

    Task: produce a JSON array of edits. Each edit must include:
      - recordId: the exact "recordId" string from the row to modify.
      - fieldName: exactly one of the editable field names listed above.
      - value: the new value as a string (numbers as their decimal string form).

    Rules:
    - The user can refer to a row by row number ("row 2"), by material name
      ("Material A"), or by brand/vendor. Resolve to the matching recordId.
    - If the user wants to change multiple fields or multiple rows, return one
      entry per (recordId, fieldName) pair.
    - For dates, normalize to DD/MM/YYYY.
    - For currencies, convert symbols to codes (€ -> EUR, $ -> USD, £ -> GBP).
    - If the request is ambiguous or no row matches, return an empty array.
    - DO NOT invent values the user did not provide.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'List of cell edits to apply to the records table',
          items: {
            type: Type.OBJECT,
            properties: {
              recordId: { type: Type.STRING, description: 'recordId of the row to modify' },
              fieldName: { type: Type.STRING, description: 'one of the editable field names' },
              value: { type: Type.STRING, description: 'new value as a string' }
            },
            required: ['recordId', 'fieldName', 'value']
          }
        }
      }
    });

    const jsonStr = response.text.trim();
    if (!jsonStr) return [];
    const raw = JSON.parse(jsonStr) as RecordEdit[];
    const validIds = new Set(records.map(r => r.id));
    const validFields = new Set<string>(EDITABLE_FIELDS);
    return raw.filter(e => validIds.has(e.recordId) && validFields.has(e.fieldName));
  } catch (error) {
    console.error("Error parsing record edits with Gemini:", error);
    throw new Error("Failed to parse edit instruction.");
  }
};
