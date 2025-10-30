import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { DataGrid } from './components/DataGrid';
import { AgentChat } from './components/AgentChat';
import { UploadIcon, HistoryIcon, DownloadIcon } from './components/Icons';
import { parseCommand, generateColumnDescriptions } from './services/geminiService';
import { applyStep, previewStep } from './services/dataProcessor';
import { inferColumnTypes } from './services/typeDetector';
import { AgentStatus, TableData, Step, Message, PreviewData, Operation, ColumnSchema, SortConfig, SortDirection, ConditionalFormatRule } from './types';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const [tableData, setTableData] = useState<TableData>({ headers: [], rows: [] });
  const [columnSchema, setColumnSchema] = useState<ColumnSchema>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [fileName, setFileName] = useState<string>('');
  const [history, setHistory] = useState<{ data: TableData; steps: Step[] }[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(AgentStatus.Idle);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [conditionalFormats, setConditionalFormats] = useState<ConditionalFormatRule[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearState = () => {
    setTableData({ headers: [], rows: [] });
    setColumnSchema({});
    setSortConfig(null);
    setFileName('');
    setHistory([]);
    setSteps([]);
    setMessages([]);
    setAgentStatus(AgentStatus.Idle);
    setPreviewData(null);
    setConditionalFormats([]);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      clearState();
      setFileName(file.name);
      setAgentStatus(AgentStatus.Applying);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, any>[];
          const initialData = { headers, rows };
          
          const types = inferColumnTypes(rows, headers);
          const initialSchema: ColumnSchema = {};
          headers.forEach(h => {
              initialSchema[h] = { type: types[h] || 'string' };
          });
          setColumnSchema(initialSchema);

          setTableData(initialData);
          setHistory([{ data: initialData, steps: [] }]);
          setMessages([{ id: uuidv4(), sender: 'agent', content: `Loaded ${file.name}. ${rows.length} rows and ${headers.length} columns. Ready for your instructions.` }]);
          setAgentStatus(AgentStatus.Idle);

          // Asynchronously fetch and update descriptions
          generateColumnDescriptions(headers, rows)
            .then(descriptions => {
              setColumnSchema(prevSchema => {
                const newSchema = { ...prevSchema };
                for (const header in descriptions) {
                  if (newSchema[header]) {
                    newSchema[header] = { ...newSchema[header], description: descriptions[header] };
                  }
                }
                return newSchema;
              });
            })
            .catch(err => {
              // Silently fail, descriptions are a progressive enhancement
              console.error("Failed to generate column descriptions:", err);
            });
        },
        error: (error) => {
          setMessages([{ id: uuidv4(), sender: 'agent', content: `Error parsing CSV: ${error.message}` }]);
          setAgentStatus(AgentStatus.Idle);
        }
      });
    }
  };

  const executeUndo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      const lastState = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setTableData(lastState.data);
      setSteps(lastState.steps);
      setPreviewData(null);
      setMessages(prev => [...prev, { id: uuidv4(), sender: 'agent', content: "Undo successful. Reverted to the previous state." }]);
    }
  };

  const handleSendMessage = useCallback(async (command: string) => {
    if (!tableData.headers.length || agentStatus !== AgentStatus.Idle) return;

    const userMessage: Message = { id: uuidv4(), sender: 'user', content: command };
    setMessages(prev => [...prev, userMessage]);
    setAgentStatus(AgentStatus.Interpreting);
    setPreviewData(null);

    try {
      const step = await parseCommand(command, tableData.headers);
      if (step.op === Operation.Error) {
        const agentMessage: Message = { 
          id: uuidv4(), 
          sender: 'agent', 
          content: step.params.message || "I couldn't understand that request. Could you please rephrase it?",
          suggestions: step.params.suggestions,
        };
        setMessages(prev => [...prev, agentMessage]);
        setAgentStatus(AgentStatus.Idle);
        return;
      }

      if (step.op === Operation.ConditionalFormat) {
          const newRule: ConditionalFormatRule = {
              id: uuidv4(),
              ...step.params,
          };
          setConditionalFormats(prev => [...prev, newRule]);
          setMessages(prev => [...prev, {id: uuidv4(), sender: 'agent', content: `Applied formatting rule: ${step.explanation}`}]);
          setAgentStatus(AgentStatus.Idle);
          return;
      }
      
      setAgentStatus(AgentStatus.Previewing);
      const preview = previewStep(tableData, step);
      setPreviewData({ step, ...preview });
      setAgentStatus(AgentStatus.AwaitingConfirmation);

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setMessages(prev => [...prev, { id: uuidv4(), sender: 'agent', content: `An error occurred: ${errorMessage}` }]);
      setAgentStatus(AgentStatus.Idle);
    }
  }, [tableData, agentStatus]);

  const applyChanges = () => {
    if (!previewData) return;

    setAgentStatus(AgentStatus.Applying);
    const newTableData = applyStep(tableData, previewData.step);
    const newSteps = [...steps, previewData.step];

    setTableData(newTableData);
    setSteps(newSteps);
    setHistory(prev => [...prev, { data: newTableData, steps: newSteps }]);
    
    setMessages(prev => [...prev, { id: uuidv4(), sender: 'agent', content: `Applied: ${previewData.step.explanation}` }]);
    setPreviewData(null);
    setAgentStatus(AgentStatus.Idle);
  };

  const cancelChanges = () => {
    setPreviewData(null);
    setAgentStatus(AgentStatus.Idle);
  };
  
  const handleDownload = (format: 'csv' | 'json') => {
    if (format === 'csv') {
        const csv = Papa.unparse(tableData.rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `edited_${fileName || 'data.csv'}`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        const json = JSON.stringify({ steps }, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `steps_${fileName || 'data'}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleSort = (key: string) => {
    if (sortConfig && sortConfig.key === key) {
        if (sortConfig.direction === SortDirection.Asc) {
            setSortConfig({ key, direction: SortDirection.Desc });
        } else {
            setSortConfig(null);
        }
    } else {
        setSortConfig({ key, direction: SortDirection.Asc });
    }
  };

  const handleRemoveFormat = (id: string) => {
    setConditionalFormats(prev => prev.filter(f => f.id !== id));
  };

  useEffect(() => {
    if (sortConfig && !tableData.headers.includes(sortConfig.key)) {
        setSortConfig(null);
    }
  }, [tableData.headers, sortConfig]);

  const sortedTableData = useMemo(() => {
    if (!sortConfig || !tableData.rows.length) {
      return tableData;
    }

    const sortedRows = [...tableData.rows].sort((a, b) => {
      const { key, direction } = sortConfig;
      const valA = a[key];
      const valB = b[key];
      const type = columnSchema[key]?.type || 'string';

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const order = direction === SortDirection.Asc ? 1 : -1;

      switch (type) {
        case 'number':
          return (Number(valA) - Number(valB)) * order;
        case 'date':
          return (new Date(valA).getTime() - new Date(valB).getTime()) * order;
        case 'boolean':
          return (valA === valB ? 0 : valA ? -1 : 1) * order; // true comes first asc
        case 'string':
        default:
          return String(valA).localeCompare(String(valB)) * order;
      }
    });

    return { ...tableData, rows: sortedRows };
  }, [tableData, sortConfig, columnSchema]);


  return (
    <div className="flex h-screen w-screen bg-gray-900 font-sans">
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between bg-gray-950 p-3 border-b border-gray-800 shadow-md h-16 shrink-0">
          <h1 className="text-xl font-bold text-gray-100">CSV Agent Editor</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={executeUndo}
              disabled={history.length <= 1}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <HistoryIcon className="w-4 h-4" />
              Undo
            </button>
             <div className="relative group">
                <button
                  disabled={!tableData.rows.length}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-200 bg-teal-600 rounded-md hover:bg-teal-500 disabled:opacity-50 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                >
                    <DownloadIcon className="w-4 h-4" />
                    Export
                </button>
                <div className="absolute right-0 mt-2 w-40 bg-gray-800 border border-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                    <a onClick={() => handleDownload('csv')} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer">Export CSV</a>
                    <a onClick={() => handleDownload('json')} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer">Export Steps (JSON)</a>
                </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 transition-colors"
            >
              <UploadIcon className="w-4 h-4" />
              {fileName ? 'Load New' : 'Load CSV'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </header>

        <main className="flex-1 p-4 overflow-auto">
          {tableData.rows.length > 0 ? (
            <DataGrid 
                data={sortedTableData} 
                fileName={fileName} 
                columnSchema={columnSchema}
                onSort={handleSort}
                sortConfig={sortConfig}
                conditionalFormats={conditionalFormats}
            />
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                <UploadIcon className="w-16 h-16 mb-4"/>
                <h2 className="text-2xl font-semibold mb-2">Upload a CSV file to get started</h2>
                <p>Click the "Load CSV" button in the top right corner.</p>
            </div>
          )}
        </main>
      </div>

      <aside className="w-[450px] shrink-0 bg-gray-950 border-l border-gray-800 flex flex-col h-screen">
        <AgentChat
          messages={messages}
          status={agentStatus}
          onSendMessage={handleSendMessage}
          previewData={previewData}
          onApply={applyChanges}
          onCancel={cancelChanges}
          steps={steps}
          conditionalFormats={conditionalFormats}
          onRemoveFormat={handleRemoveFormat}
        />
      </aside>
    </div>
  );
}
