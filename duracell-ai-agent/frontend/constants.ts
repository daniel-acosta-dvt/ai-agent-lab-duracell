import { Client, MasterDataRecord, ProcessedRecord } from './types';

// Standard Duracell logo from Wikimedia
export const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/a/a1/Duracell_logo.svg";

// Mock database updated with passwords from image
export const CLIENT_DATABASE: Client[] = [
  {
    name: 'Natalia Quintela',
    email: 'natalia.quintela.diaz@hotmail.com',
    company: 'duracell',
    companyCode: '123456',
    password: 'Natalia'
  },
  {
    name: 'Hanna Yi',
    email: 'xiaobaiyi71@gmail.com',
    company: 'devoteam',
    companyCode: '789456',
    password: 'Hanna'
  },
  {
    name: 'Andre Munoz',
    email: 'mandomunoz31@gmail.com',
    company: 'google cloud',
    companyCode: '456789',
    password: 'Andre'
  }
];

// Mock master data mapped to new terminology
export const MASTER_DATA: MasterDataRecord[] = [
  {
    brandCode: '1234567',
    saOaRecord: '5500001234',
    vendor: '184731 ABC',
    shortText: 'Material A',
    price: 500,
    currency: 'Eur',
    per: '1',
    uom: 'MT'
  },
  {
    brandCode: '1234566',
    saOaRecord: '5500001234',
    vendor: '184731 ABC',
    shortText: 'Material B',
    price: 750,
    currency: 'Eur',
    per: '1',
    uom: 'MT'
  },
  {
    brandCode: '1234565',
    saOaRecord: '5500001235',
    vendor: '100079 Company B',
    shortText: 'Material C',
    price: 15,
    currency: 'Eur',
    per: '100',
    uom: 'KG'
  },
  {
    brandCode: '1234564',
    saOaRecord: '5500001235',
    vendor: '100079 Company B',
    shortText: 'Material D',
    price: 20,
    currency: 'Eur',
    per: '100',
    uom: 'KG'
  },
  {
    brandCode: '1234563',
    saOaRecord: '5500001235',
    vendor: '100079 Company B',
    shortText: 'Material E',
    price: 25,
    currency: 'Eur',
    per: '100',
    uom: 'KG'
  }
];

// Mock user history to provide suggestions - will be updated dynamically in session
export const USER_HISTORY: Record<string, Partial<ProcessedRecord>> = {
  'Material A': { saLine: '10', brandDescription: 'Duracell Battery A', buyerCode: 'B001' },
  'Material B': { saLine: '20', brandDescription: 'Duracell Battery B', buyerCode: 'B001' }
};
