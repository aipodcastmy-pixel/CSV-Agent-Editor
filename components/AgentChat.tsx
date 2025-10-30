
import React, { useState, useRef, useEffect } from 'react';
import { AgentStatus, Message, PreviewData, Step } from '../types';
import { SendIcon, BotIcon, UserIcon, CheckIcon, CancelIcon, ChevronDownIcon, CodeIcon } from './Icons';

interface AgentChatProps {
  messages: Message[];
  status: AgentStatus;
  onSendMessage: (message: string) => void;
  previewData: PreviewData | null;
  onApply: () => void;
  onCancel: () => void;
  steps: Step[];
}

const StatusIndicator: React.FC<{ status: AgentStatus }> = ({ status }) => {
  const statusInfo = {
    [AgentStatus.Idle]: { text: 'Ready for instructions', color: 'bg-green-500' },
    [AgentStatus.Interpreting]: { text: 'Interpreting command...', color: 'bg-cyan-500' },
    [AgentStatus.Previewing]: { text: 'Generating preview...', color: 'bg-blue-500' },
    [AgentStatus.AwaitingConfirmation]: { text: 'Awaiting confirmation', color: 'bg-yellow-500' },
    [AgentStatus.Applying]: { text: 'Applying changes...', color: 'bg-purple-500' },
  };
  const { text, color } = statusInfo[status] || { text: 'Unknown', color: 'bg-gray-500' };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-300">
      <span className={`w-2.5 h-2.5 rounded-full ${color} animate-pulse`}></span>
      <span>{text}</span>
    </div>
  );
};

const ActionCard: React.FC<{ preview: PreviewData; onApply: () => void; onCancel: () => void; }> = ({ preview, onApply, onCancel }) => {
  const { step, diff, sample } = preview;
  
  return (
    <div className="bg-gray-800 border border-indigo-500/50 rounded-lg p-4 my-2 text-sm animate-fade-in">
        <p className="font-semibold text-gray-100 mb-2">{step.explanation}</p>
        
        <div className="grid grid-cols-3 gap-2 text-center my-4">
            <div className="bg-gray-700 p-2 rounded">
                <p className="text-xl font-bold text-red-400">{diff.rowsRemoved}</p>
                <p className="text-xs text-gray-400">Rows Removed</p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
                <p className="text-xl font-bold text-green-400">{diff.rowsAdded}</p>
                <p className="text-xs text-gray-400">Rows Added</p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
                <p className="text-xl font-bold text-blue-400">{diff.rowsModified}</p>
                <p className="text-xs text-gray-400">Rows Modified</p>
            </div>
        </div>

        {sample.length > 0 && (
            <details className="text-xs bg-gray-900/50 rounded p-2">
                <summary className="cursor-pointer font-medium text-gray-300 flex items-center">
                    <ChevronDownIcon className="w-4 h-4 mr-1"/>
                    Show Example Diff
                </summary>
                <table className="w-full mt-2">
                    <thead>
                        <tr className="text-left text-gray-400">
                            {Object.keys(sample[0]).map(h => <th key={h} className="font-normal p-1">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {sample.map((row, i) => (
                            <tr key={i} className={row.__status === 'added' ? 'bg-green-900/30' : row.__status === 'removed' ? 'bg-red-900/30' : ''}>
                                {Object.keys(row).map(h => <td key={h} className="p-1 truncate max-w-[100px]">{String(row[h as keyof typeof row])}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        )}

        <div className="flex justify-end gap-2 mt-4">
            <button onClick={onCancel} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white flex items-center gap-2 transition-colors">
                <CancelIcon className="w-4 h-4" /> Cancel
            </button>
            <button onClick={onApply} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 transition-colors">
                <CheckIcon className="w-4 h-4" /> Apply
            </button>
        </div>
    </div>
  );
};

const StepsLog: React.FC<{ steps: Step[] }> = ({ steps }) => {
    return (
        <div className="p-4 text-sm">
            <h3 className="text-lg font-bold text-gray-200 mb-4">Operation History</h3>
            {steps.length === 0 ? (
                <p className="text-gray-500">No operations have been applied yet.</p>
            ) : (
                <ol className="relative border-l border-gray-700 ml-2">
                    {steps.map((step, index) => (
                        <li key={index} className="mb-6 ml-6">
                            <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-900 rounded-full -left-3 ring-8 ring-gray-900">
                                <CodeIcon className="w-3 h-3 text-blue-300"/>
                            </span>
                            <h4 className="flex items-center mb-1 text-base font-semibold text-gray-100">{step.op}</h4>
                            <p className="mb-2 text-sm font-normal text-gray-400">{step.explanation}</p>
                            <details>
                                <summary className="text-xs text-indigo-400 cursor-pointer">View params</summary>
                                <pre className="text-xs bg-gray-950 p-2 rounded-md mt-1 overflow-auto text-gray-300">{JSON.stringify(step.params, null, 2)}</pre>
                            </details>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export const AgentChat: React.FC<AgentChatProps> = ({ messages, status, onSendMessage, previewData, onApply, onCancel, steps }) => {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'steps'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, previewData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === AgentStatus.Idle) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (status === AgentStatus.Idle) {
      onSendMessage(suggestion);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-950">
      <header className="p-4 border-b border-gray-800 shrink-0">
        <div className="flex border-b border-gray-800 mb-4">
            <button onClick={() => setActiveTab('chat')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'chat' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}>Agent</button>
            <button onClick={() => setActiveTab('steps')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'steps' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}>History</button>
        </div>
        {activeTab === 'chat' && <StatusIndicator status={status} />}
      </header>
      
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chat' ? (
            <div className="p-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === 'agent' && <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0"><BotIcon className="w-5 h-5 text-white" /></div>}
                    <div className={`max-w-sm p-3 rounded-lg text-sm ${msg.sender === 'user' ? 'bg-gray-700 text-gray-100' : 'bg-gray-800 text-gray-200'}`}>
                        {msg.content}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-700/50">
                                <p className="text-xs text-gray-400 mb-2 font-medium">Some suggestions:</p>
                                <div className="flex flex-col items-start gap-2">
                                    {msg.suggestions.map((suggestion, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="text-left text-sm text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/60 px-3 py-1.5 rounded-md transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={status !== AgentStatus.Idle}
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center shrink-0"><UserIcon className="w-5 h-5 text-white" /></div>}
                    </div>
                ))}
                {previewData && <ActionCard preview={previewData} onApply={onApply} onCancel={onCancel} />}
                <div ref={messagesEndRef} />
            </div>
        ) : (
            <StepsLog steps={steps} />
        )}
      </div>

      {activeTab === 'chat' && (
        <div className="p-4 border-t border-gray-800 shrink-0">
            <form onSubmit={handleSubmit} className="relative">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={status === AgentStatus.Idle ? "e.g., remove duplicate rows by email" : "Waiting for agent..."}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-4 pr-12 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={status !== AgentStatus.Idle}
            />
            <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                disabled={!input.trim() || status !== AgentStatus.Idle}
            >
                <SendIcon className="w-5 h-5 text-white" />
            </button>
            </form>
        </div>
      )}
    </div>
  );
};
