export interface Client {
  name: string;
  email: string;
  company: string;
  companyCode: string;
  password?: string;
}

export interface MasterDataRecord {
  brandCode: string; // Material ID
  saOaRecord: string; // Purchasing Document
  vendor: string;
  shortText: string;
  price: number;
  currency: string;
  per: string;
  uom: string;
  // New fields to remember
  saLine?: string;
  brandDescription?: string;
  previousPrice?: number;
  buyerCode?: string;
}

export interface ExtractedPriceUpdate {
  normalizedMaterialName: string;
  price: number;
  currency: string;
  per: string;
  uom: string;
  validityStartDate: string;
  supplierName: string;
}

export interface ProcessedRecord {
  id: string;
  // Official Form Fields
  saOaRecord: string;
  vendorName: string;
  vendorCode: string;
  saLine: string;
  brandCode: string;
  brandDescription: string;
  previousPrice: string;
  newPrice: number;
  validityStartDate: string;
  validityEndDate: string;
  currency: string;
  per: string;
  uom: string;
  buyerCode: string;
  comments: string;
  
  // Internal tracking
  shortText: string; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  text: string;
}

export interface MissingField {
  recordId: string;
  fieldName: keyof ProcessedRecord;
  description: string;
  itemName: string;
  suggestion?: string;
}
