import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Client, ProcessedRecord, ChatMessage, MissingField } from '../types';
import { MASTER_DATA, USER_HISTORY, LOGO_URL } from '../constants';
import { extractPricingData, parseUserCorrection, parseRecordEdits } from '../services/geminiService';
import { LogOut, FileText, Loader2, CheckCircle2, Send, Bot, Check, RefreshCw, Mail, XCircle } from 'lucide-react';

interface DashboardProps {
  client: Client;
  onLogout: () => void;
}

type AppState = 'idle' | 'processing' | 'gathering_info' | 'review' | 'submitted';

const Dashboard: React.FC<DashboardProps> = ({ client, onLogout }) => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'system',
      text: `Hello **${client.name.split(' ')[0]}**, I am your Duracell AI Agent. Please enter your price change request (paste the email content) to begin.`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [records, setRecords] = useState<ProcessedRecord[]>([]);
  const [currentMissingField, setCurrentMissingField] = useState<MissingField | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  const [sessionHistory, setSessionHistory] = useState<Record<string, Partial<ProcessedRecord>>>(USER_HISTORY);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const addMessage = useCallback((role: 'user' | 'system', text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, text }]);
  }, []);

  // --- LOGIC: Evaluate what is missing with specific hints ---
  const findNextMissingField = (currentRecords: ProcessedRecord[]): MissingField | null => {
    for (const r of currentRecords) {
      if (!r.vendorCode) {
        return { 
          recordId: r.id, 
          fieldName: 'vendorCode', 
          description: 'DURACELL VENDOR CODE', 
          itemName: r.vendorName,
          suggestion: client.companyCode 
        };
      }
      if (!r.brandCode) {
        const suggestion = sessionHistory[r.shortText]?.brandCode;
        return { 
          recordId: r.id, 
          fieldName: 'brandCode', 
          description: 'BRAND CODE/SORT CODE (Material/GCAS#)', 
          itemName: r.shortText, 
          suggestion 
        };
      }
      if (!r.saOaRecord) {
        const suggestion = sessionHistory[r.shortText]?.saOaRecord;
        return { 
          recordId: r.id, 
          fieldName: 'saOaRecord', 
          description: 'DURACELL SA/OA RECORD #', 
          itemName: r.shortText, 
          suggestion 
        };
      }
      if (!r.saLine) {
        const suggestion = sessionHistory[r.shortText]?.saLine;
        return { 
          recordId: r.id, 
          fieldName: 'saLine', 
          description: 'SA LINE #', 
          itemName: r.shortText, 
          suggestion 
        };
      }
      if (!r.brandDescription) {
        const suggestion = sessionHistory[r.shortText]?.brandDescription;
        return { 
          recordId: r.id, 
          fieldName: 'brandDescription', 
          description: 'BRAND CODE DESCRIPTION', 
          itemName: r.shortText, 
          suggestion 
        };
      }
      if (!r.previousPrice) {
        const suggestion = sessionHistory[r.shortText]?.previousPrice;
        return { 
          recordId: r.id, 
          fieldName: 'previousPrice', 
          description: 'PREVIOUS PRICE', 
          itemName: r.shortText, 
          suggestion 
        };
      }
      if (!r.validityStartDate) {
        return { 
          recordId: r.id, 
          fieldName: 'validityStartDate', 
          description: 'VALIDITY START DATE', 
          itemName: r.shortText 
        };
      }
      if (!r.validityEndDate) {
        return { 
          recordId: r.id, 
          fieldName: 'validityEndDate', 
          description: 'VALIDITY END DATE', 
          itemName: r.shortText, 
          suggestion: '31/12/9999' 
        };
      }
      if (!r.uom) {
        const suggestion = sessionHistory[r.shortText]?.uom;
        return { 
          recordId: r.id, 
          fieldName: 'uom', 
          description: 'UOM (Unit of Measure)', 
          itemName: r.shortText, 
          suggestion 
        };
      }
      if (!r.per) {
        const suggestion = sessionHistory[r.shortText]?.per || '1';
        return { 
          recordId: r.id, 
          fieldName: 'per', 
          description: 'PER (Quantity)', 
          itemName: r.shortText, 
          suggestion 
        };
      }
      if (!r.buyerCode) {
        const suggestion = sessionHistory[r.shortText]?.buyerCode;
        return { 
          recordId: r.id, 
          fieldName: 'buyerCode', 
          description: 'BUYER CODE/NAME', 
          itemName: r.shortText, 
          suggestion 
        };
      }
    }
    return null;
  };

  const getFieldHint = (fieldName: string): string => {
    switch (fieldName) {
      case 'vendorCode': return "This is your unique 6-digit supplier identifier in our SAP system.";
      case 'brandCode': return "Also known as the Material ID or GCAS number. It usually starts with '123'.";
      case 'saOaRecord': return "This is the Purchasing Document number (Scheduling Agreement or Open Agreement), typically starting with '55'.";
      case 'saLine': return "The specific line item number within your agreement (e.g., 10, 20, 30).";
      case 'brandDescription': return "A short text describing the material as it appears in our catalog.";
      case 'previousPrice': return "The current price before this update. This helps us validate the change percentage.";
      case 'validityStartDate': return "When should this new price take effect? Please use the format DD/MM/YYYY.";
      case 'validityEndDate': return "When does this price expire? We usually use 31/12/9999 for indefinite validity.";
      case 'uom': return "Unit of Measure like MT (Metric Ton), KG, or PC (Piece).";
      case 'per': return "The quantity the price applies to. For example, '1' for price per unit, or '1000' for price per thousand.";
      case 'buyerCode': return "The code or name of the Duracell buyer responsible for this category.";
      default: return "";
    }
  };

  const promptForMissingField = useCallback((field: MissingField) => {
    setCurrentMissingField(field);
    setAppState('gathering_info');
    
    const hint = getFieldHint(field.fieldName);
    let msg = `I need to fill the **${field.description}** for **${field.itemName}**. \n\n*Hint: ${hint}*`;
    
    if (field.suggestion) {
      msg += `\n\nI found a suggestion from your history: **${field.suggestion}**. \nIs this correct? (You can say "yes" or provide the correct value).`;
    } else {
      msg += `\n\nPlease provide this value.`;
    }
    addMessage('system', msg);
  }, [addMessage]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || appState === 'processing') return;

    const userText = inputText.trim();
    setInputText('');
    addMessage('user', userText);

    if (appState === 'idle') {
      setAppState('processing');
      try {
        const extractedData = await extractPricingData(userText, client.company);
        if (extractedData.length === 0) {
          addMessage('system', "I couldn't find any pricing data in that text. Please ensure the email contains material names and prices (e.g., 'Material A: 500 EUR').");
          setAppState('idle');
          return;
        }

        const newRecords: ProcessedRecord[] = extractedData.map((extracted, index) => {
          const matchedMasterRecord = MASTER_DATA.find(
            record => record.shortText.toLowerCase() === extracted.normalizedMaterialName.toLowerCase()
          );

          const hist = sessionHistory[extracted.normalizedMaterialName] || {};

          return {
            id: `rec_${Date.now()}_${index}`,
            saOaRecord: matchedMasterRecord?.saOaRecord || hist.saOaRecord || '',
            vendorName: client.company,
            vendorCode: client.companyCode || '',
            saLine: hist.saLine || '',
            brandCode: matchedMasterRecord?.brandCode || hist.brandCode || '',
            brandDescription: hist.brandDescription || '',
            previousPrice: hist.previousPrice || '',
            newPrice: extracted.price,
            validityStartDate: extracted.validityStartDate || '',
            validityEndDate: hist.validityEndDate || '',
            currency: extracted.currency.replace('€', 'EUR'),
            per: extracted.per || matchedMasterRecord?.per || hist.per || '1',
            uom: extracted.uom || matchedMasterRecord?.uom || hist.uom || '',
            buyerCode: hist.buyerCode || '',
            comments: '',
            shortText: extracted.normalizedMaterialName
          };
        });

        setRecords(newRecords);
        
        const nextField = findNextMissingField(newRecords);
        if (nextField) {
          promptForMissingField(nextField);
        } else {
          setAppState('review');
          addMessage('system', 'Excellent! I have all the information. Review the form on the right — you can edit any cell directly, or just tell me what to change (e.g. *"Change Material A price to 1200"*). Press **Submit Request** when ready.');
        }
      } catch (err) {
        console.error(err);
        addMessage('system', 'An error occurred while processing. Please try again.');
        setAppState('idle');
      }
    } else if (appState === 'review') {
      setAppState('processing');
      try {
        const edits = await parseRecordEdits(userText, records);
        if (edits.length === 0) {
          addMessage('system', "I couldn't pin that down to a specific cell. Try something like *'Change the new price for Material A to 1200'* or *'Set the buyer code on row 1 to B001'*.");
          setAppState('review');
          return;
        }

        const updatedRecords = records.map(r => {
          const rowEdits = edits.filter(e => e.recordId === r.id);
          if (rowEdits.length === 0) return r;
          const next = { ...r };
          for (const edit of rowEdits) {
            const value = edit.fieldName === 'newPrice' ? parseFloat(edit.value) : edit.value;
            (next as any)[edit.fieldName] = value;
          }
          return next;
        });
        setRecords(updatedRecords);

        setSessionHistory(prev => {
          const next = { ...prev };
          for (const edit of edits) {
            const target = updatedRecords.find(r => r.id === edit.recordId);
            if (!target) continue;
            next[target.shortText] = {
              ...next[target.shortText],
              [edit.fieldName]: edit.fieldName === 'newPrice' ? parseFloat(edit.value) : edit.value,
            };
          }
          return next;
        });

        const summary = edits.map(e => {
          const r = updatedRecords.find(x => x.id === e.recordId);
          const label = r?.shortText || 'row';
          return `• **${label}** — ${e.fieldName}: **${e.value}**`;
        }).join('\n');
        addMessage('system', `Done. Applied ${edits.length} change${edits.length === 1 ? '' : 's'}:\n${summary}`);
        setAppState('review');
      } catch (err) {
        console.error(err);
        addMessage('system', "Sorry, I had trouble understanding that edit. Could you rephrase?");
        setAppState('review');
      }
    } else if (appState === 'gathering_info' && currentMissingField) {
      setAppState('processing');
      try {
        const extractedValue = await parseUserCorrection(userText, currentMissingField);
        
        const updatedRecords = records.map(r => {
          if (r.id === currentMissingField.recordId) {
            const updated = { ...r, [currentMissingField.fieldName]: extractedValue };
            
            if (currentMissingField.fieldName === 'brandCode' && extractedValue) {
              const masterMatch = MASTER_DATA.find(m => m.brandCode === extractedValue);
              if (masterMatch) {
                updated.saOaRecord = updated.saOaRecord || masterMatch.saOaRecord;
                updated.uom = updated.uom || masterMatch.uom;
                updated.per = updated.per || masterMatch.per;
              }
            }
            return updated;
          }
          return r;
        });

        setRecords(updatedRecords);
        
        const targetRecord = updatedRecords.find(r => r.id === currentMissingField.recordId);
        if (targetRecord) {
          setSessionHistory(prev => ({
            ...prev,
            [targetRecord.shortText]: {
              ...prev[targetRecord.shortText],
              [currentMissingField.fieldName]: extractedValue
            }
          }));
        }

        const nextField = findNextMissingField(updatedRecords);
        if (nextField) {
          promptForMissingField(nextField);
        } else {
          setCurrentMissingField(null);
          setAppState('review');
          addMessage('system', 'Perfect! I have all the necessary information now. Review the table — you can edit any cell directly or tell me what to change. When ready, press **Submit Request**.');
        }
      } catch (err) {
        console.error(err);
        addMessage('system', 'I had trouble understanding that. Could you please provide the value again?');
        setAppState('gathering_info');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLoadExample = () => {
    setInputText(`Hi Caroline,\n\nDuracell AAR - H1’26 price\nMaterialA: 1000€/MT,\nMaterial X: 1500€/MT\n\nKind Regards,\nCaroline\nCompany ABC`);
  };

  const handleRecordChange = (id: string, field: keyof ProcessedRecord, value: string | number) => {
    setRecords(records.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSubmitRequest = async () => {
    const previousState = appState;
    setAppState('processing');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            name: client.name,
            email: client.email,
            company: client.company,
            companyCode: client.companyCode,
          },
          records,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Backend ${res.status}: ${errBody}`);
      }
      const { id } = await res.json();
      addMessage('system', `✅ **Request submitted successfully.** Saved as \`${id}\`.`);
      setAppState('submitted');
    } catch (err) {
      console.error('Submit failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addMessage('system', `⚠️ Submit failed: ${msg}. Please try again.`);
      setAppState(previousState);
    }
  };

  const handleSendEmailCopy = () => {
    setSendingEmail(true);
    setTimeout(() => {
      setSendingEmail(false);
      setEmailSent(true);
    }, 1500);
  };

  const handleReset = () => {
    setRecords([]);
    setAppState('idle');
    setCurrentMissingField(null);
    setEmailSent(false);
    setMessages([{
      id: Date.now().toString(),
      role: 'system',
      text: `Hello **${client.name.split(' ')[0]}**, I am your Duracell AI Agent. Please enter your price change request.`
    }]);
  };

  const Th = ({ children, isRed = false }: { children: React.ReactNode, isRed?: boolean }) => (
    <th scope="col" className={`px-2 py-3 text-center text-[10px] font-bold border border-duracell-white align-middle ${isRed ? 'bg-[#FF0000] text-white' : 'bg-[#D49A7A] text-white'}`}>
      {children}
    </th>
  );

  if (appState === 'submitted') {
    return (
      <div className="min-h-screen bg-duracell-black flex flex-col items-center justify-center p-4 font-sans">
        <div className="mb-12">
          <img src={LOGO_URL} alt="Duracell" className="h-20 object-contain" />
        </div>
        
        <div className="bg-duracell-white rounded-xl shadow-2xl p-12 max-w-lg w-full text-center border border-duracell-copper">
          <div className="flex justify-center mb-8">
            <div className="bg-[#E8F5E9] p-6 rounded-full animate-check shadow-lg border-4 border-duracell-success">
              <CheckCircle2 className="w-20 h-20 text-duracell-success" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-duracell-black mb-4">Success!</h2>
          <p className="text-xl text-duracell-darkGray mb-10 leading-relaxed">
            Request submitted successfully.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={handleSendEmailCopy}
              disabled={emailSent || sendingEmail}
              className={`w-full flex items-center justify-center py-3 px-6 rounded-lg font-bold text-sm transition-all shadow-sm border ${
                emailSent 
                  ? 'bg-green-50 text-duracell-success border-duracell-success cursor-default' 
                  : 'bg-duracell-white text-duracell-copper border-duracell-copper hover:bg-duracell-lightGray'
              }`}
            >
              {sendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : emailSent ? <Check className="w-4 h-4 mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              {emailSent ? 'Copy sent to your email' : 'Send a copy to my email'}
            </button>

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center py-4 px-6 bg-duracell-copper text-duracell-white rounded-lg font-bold text-lg hover:bg-[#904B0B] transition-all shadow-md"
            >
              <RefreshCw className="w-5 h-5 mr-3" />
              Submit Another Request
            </button>
            
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center py-3 px-6 text-duracell-error font-semibold hover:bg-red-50 rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Close App
            </button>
          </div>
        </div>
      </div>
    );
  }

  const requiredFields: (keyof ProcessedRecord)[] = [
    'vendorCode', 'brandCode', 'saOaRecord', 'saLine', 'brandDescription',
    'previousPrice', 'validityStartDate', 'validityEndDate', 'uom', 'per', 'buyerCode'
  ];
  const pendingCount = records.reduce(
    (sum, r) => sum + requiredFields.filter(f => !r[f]).length, 0
  );
  const canSubmit = records.length > 0 && pendingCount === 0 && appState !== 'processing';

  return (
    <div className="h-screen bg-duracell-lightGray flex flex-col font-sans overflow-hidden">
      <header className="bg-duracell-black shadow-md z-10 border-b-4 border-duracell-copper flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src={LOGO_URL} alt="Duracell" className="h-10 object-contain mr-4" />
            <h1 className="text-lg font-bold text-duracell-white hidden sm:block tracking-wide">Duracell AI Agent</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-duracell-white text-right hidden md:block">
              <p className="font-semibold">{client.name}</p>
              <p className="text-duracell-mediumGray text-xs">{client.company} (Code: {client.companyCode})</p>
            </div>
            <button onClick={onLogout} className="p-2 text-duracell-mediumGray hover:text-duracell-white hover:bg-duracell-darkGray rounded transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <aside className="flex flex-col bg-duracell-white border-b lg:border-b-0 lg:border-r border-duracell-mediumGray shadow-lg w-full lg:w-96 lg:flex-shrink-0 h-2/5 lg:h-auto overflow-hidden">
          <div className="p-4 border-b border-duracell-mediumGray bg-duracell-lightGray flex justify-between items-center flex-shrink-0">
            <h2 className="text-[15px] font-bold text-duracell-black flex items-center">
              <Bot className="w-5 h-5 mr-2 text-duracell-copper" /> Assistant
            </h2>
            {appState === 'idle' && (
              <button onClick={handleLoadExample} className="text-xs text-duracell-copper hover:text-[#904B0B] font-semibold underline">Load Example</button>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-duracell-white space-y-4 min-h-0">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-4 py-3 text-[12px] shadow-sm ${msg.role === 'user' ? 'bg-duracell-copper text-duracell-white rounded-br-none' : 'bg-duracell-lightGray border border-duracell-mediumGray text-duracell-black rounded-bl-none'}`}>
                  {msg.role === 'system' && <div className="flex items-center mb-1 text-[10px] font-bold text-duracell-darkGray uppercase tracking-wider"><Bot className="w-3 h-3 mr-1" /> System</div>}
                  <div className="whitespace-pre-wrap break-words">{msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : part)}</div>
                </div>
              </div>
            ))}
            {appState === 'processing' && (
              <div className="flex justify-start">
                <div className="bg-duracell-lightGray border border-duracell-mediumGray rounded-lg rounded-bl-none px-4 py-3 shadow-sm flex items-center space-x-2">
                  <div className="w-2 h-2 bg-duracell-copper rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-duracell-copper rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-duracell-copper rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 bg-duracell-lightGray border-t border-duracell-mediumGray flex-shrink-0">
            <div className="relative flex items-end">
              <textarea
                className="w-full bg-duracell-white border border-duracell-mediumGray rounded pl-3 pr-12 py-2 focus:ring-2 focus:ring-duracell-copper focus:border-duracell-copper resize-none text-[12px] max-h-32 min-h-[40px] text-duracell-black"
                placeholder={appState === 'idle' ? "Paste the email here..." : appState === 'review' ? "Tell me what to change..." : "Type your response..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={appState === 'processing'}
                rows={inputText.split('\n').length > 1 ? Math.min(inputText.split('\n').length, 4) : 1}
              />
              <button onClick={handleSendMessage} disabled={appState === 'processing' || !inputText.trim()} className="absolute right-1.5 bottom-1.5 p-1.5 text-duracell-white bg-duracell-copper rounded hover:bg-[#904B0B] disabled:bg-duracell-mediumGray transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 min-w-0">
          <div className="flex-1 flex flex-col bg-duracell-white rounded-lg shadow-lg border border-duracell-mediumGray overflow-hidden min-h-0">
          <div className="p-4 border-b border-duracell-mediumGray bg-duracell-lightGray flex justify-between items-center">
            <h2 className="text-[15px] font-bold text-duracell-black mr-4 uppercase tracking-wide">Price Change Request Form</h2>
            <div className="flex space-x-2">
              {records.length > 0 && <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-duracell-white border border-duracell-mediumGray text-duracell-darkGray">{records.length} Records</span>}
              {appState === 'review' && <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-duracell-success border border-duracell-success"><CheckCircle2 className="w-3 h-3 mr-1" /> Ready for review</span>}
            </div>
          </div>

          <div className="p-0 flex-1 overflow-auto relative">
            {records.length === 0 && appState !== 'processing' && (
              <div className="h-full flex flex-col items-center justify-center text-duracell-mediumGray p-10">
                <FileText className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-[12px] font-semibold">Waiting for data to generate the form.</p>
              </div>
            )}
            {records.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-max w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <Th>DURACELL<br/>SA/OA RECORD #</Th>
                      <Th isRed>VENDOR NAME</Th>
                      <Th isRed>DURACELL<br/>VENDOR CODE</Th>
                      <Th isRed>SA LINE #</Th>
                      <Th>BRAND CODE/SORT CODE<br/>(Material/GCAS#)</Th>
                      <Th isRed>BRAND CODE DESCRIPTION</Th>
                      <Th isRed>PREVIOUS<br/>PRICE</Th>
                      <Th>NEW<br/>PRICE</Th>
                      <Th>VALIDITY<br/>START<br/>DATE</Th>
                      <Th isRed>VALIDITY<br/>END DATE</Th>
                      <Th>CURRENCY</Th>
                      <Th>PER</Th>
                      <Th>UOM</Th>
                      <Th isRed>BUYER<br/>CODE/NAME</Th>
                      <Th>COMMENTS</Th>
                    </tr>
                  </thead>
                  <tbody className="bg-duracell-white">
                    {records.map((row) => {
                      const baseInput = "w-full rounded px-1 py-1 text-[11px] text-center focus:border-duracell-copper focus:ring-1 focus:ring-duracell-copper bg-duracell-white";
                      const cls = (value: string | number) =>
                        `${baseInput} border ${value === '' || value === undefined || value === null ? 'border-duracell-warning bg-orange-50' : 'border-duracell-mediumGray'}`;
                      return (
                        <tr key={row.id} className="hover:bg-duracell-lightGray transition-colors">
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[120px]">
                            <input type="text" value={row.saOaRecord} onChange={(e) => handleRecordChange(row.id, 'saOaRecord', e.target.value)} className={cls(row.saOaRecord)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[120px]">
                            <input type="text" value={row.vendorName} onChange={(e) => handleRecordChange(row.id, 'vendorName', e.target.value)} className={cls(row.vendorName)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[100px]">
                            <input type="text" value={row.vendorCode} onChange={(e) => handleRecordChange(row.id, 'vendorCode', e.target.value)} className={cls(row.vendorCode)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[80px]">
                            <input type="text" value={row.saLine} onChange={(e) => handleRecordChange(row.id, 'saLine', e.target.value)} className={cls(row.saLine)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[120px]">
                            <input type="text" value={row.brandCode} onChange={(e) => handleRecordChange(row.id, 'brandCode', e.target.value)} className={`${cls(row.brandCode)} font-mono`} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[150px]">
                            <input type="text" value={row.brandDescription} onChange={(e) => handleRecordChange(row.id, 'brandDescription', e.target.value)} className={cls(row.brandDescription)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[100px]">
                            <input type="text" value={row.previousPrice} onChange={(e) => handleRecordChange(row.id, 'previousPrice', e.target.value)} className={cls(row.previousPrice)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[80px]">
                            <input type="number" value={row.newPrice} onChange={(e) => handleRecordChange(row.id, 'newPrice', parseFloat(e.target.value))} className={`${cls(row.newPrice)} font-bold text-duracell-success`} />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[100px]">
                            <input type="text" value={row.validityStartDate} onChange={(e) => handleRecordChange(row.id, 'validityStartDate', e.target.value)} className={cls(row.validityStartDate)} placeholder="DD/MM/YYYY" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[100px]">
                            <input type="text" value={row.validityEndDate} onChange={(e) => handleRecordChange(row.id, 'validityEndDate', e.target.value)} className={cls(row.validityEndDate)} placeholder="DD/MM/YYYY" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[70px]">
                            <input type="text" value={row.currency} onChange={(e) => handleRecordChange(row.id, 'currency', e.target.value)} className={cls(row.currency)} />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[60px]">
                            <input type="text" value={row.per} onChange={(e) => handleRecordChange(row.id, 'per', e.target.value)} className={cls(row.per)} />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[60px]">
                            <input type="text" value={row.uom} onChange={(e) => handleRecordChange(row.id, 'uom', e.target.value)} className={cls(row.uom)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[120px]">
                            <input type="text" value={row.buyerCode} onChange={(e) => handleRecordChange(row.id, 'buyerCode', e.target.value)} className={cls(row.buyerCode)} placeholder="Pending" />
                          </td>
                          <td className="px-2 py-2 border border-duracell-mediumGray min-w-[150px]">
                            <input type="text" value={row.comments} onChange={(e) => handleRecordChange(row.id, 'comments', e.target.value)} className={`${baseInput} border border-duracell-mediumGray`} placeholder="Optional" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-4 bg-duracell-lightGray border-t border-duracell-mediumGray flex justify-between items-center flex-shrink-0">
            <button onClick={handleReset} className="px-4 py-2 text-[12px] font-bold text-duracell-darkGray bg-duracell-white border border-duracell-darkGray rounded hover:bg-[#E0E0E0] transition-colors">Cancel / Reset</button>
            <div className="flex items-center space-x-3">
              {records.length > 0 && pendingCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold bg-orange-50 text-duracell-warning border border-duracell-warning">
                  {pendingCount} pending
                </span>
              )}
              <button
                onClick={handleSubmitRequest}
                disabled={!canSubmit}
                title={
                  records.length === 0
                    ? 'Add data first'
                    : pendingCount > 0
                      ? `${pendingCount} required cell${pendingCount === 1 ? '' : 's'} still empty`
                      : 'Submit the request'
                }
                className="flex items-center px-6 py-2 text-[12px] font-bold text-duracell-white bg-duracell-success rounded hover:bg-[#187718] transition-colors shadow-sm disabled:bg-duracell-mediumGray disabled:cursor-not-allowed disabled:hover:bg-duracell-mediumGray"
              >
                <Check className="w-4 h-4 mr-2" /> Submit Request
              </button>
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
