import React, { useState } from 'react';
import { TableData, ColumnSchema, ColumnType, SortConfig, SortDirection, ConditionalFormatRule, FormattingColor } from '../types';
import { ArrowUpIcon, ArrowDownIcon } from './Icons';

interface DataGridProps {
  data: TableData;
  fileName: string;
  columnSchema: ColumnSchema;
  onSort: (key: string) => void;
  sortConfig: SortConfig;
  conditionalFormats: ConditionalFormatRule[];
}

const ROWS_PER_PAGE = 100;

const TypeBadge: React.FC<{ type: ColumnType }> = ({ type }) => {
  const typeInfo = {
    string: { short: 'Abc', color: 'bg-gray-600 text-gray-200', title: 'Text' },
    number: { short: '123', color: 'bg-blue-600 text-blue-100', title: 'Number' },
    date: { short: 'Date', color: 'bg-green-600 text-green-100', title: 'Date' },
    boolean: { short: 'T/F', color: 'bg-purple-600 text-purple-100', title: 'Boolean' },
  };

  const info = typeInfo[type] || typeInfo.string;

  return (
    <span 
      className={`px-1.5 py-0.5 text-xs font-semibold rounded-md ${info.color}`}
      title={info.title}
    >
      {info.short}
    </span>
  );
};

const isNumeric = (val: any): boolean => !isNaN(parseFloat(val)) && isFinite(val);

const checkCondition = (cellValue: any, rule: ConditionalFormatRule): boolean => {
    if (cellValue === null || cellValue === undefined) return false;

    const ruleValue = isNumeric(rule.value) ? parseFloat(rule.value as string) : rule.value;
    const comparableCellValue = isNumeric(cellValue) ? parseFloat(cellValue) : cellValue;

    switch (rule.condition) {
        case 'equals': return comparableCellValue == ruleValue;
        case 'not_equals': return comparableCellValue != ruleValue;
        case 'gt': return comparableCellValue > ruleValue;
        case 'lt': return comparableCellValue < ruleValue;
        case 'gte': return comparableCellValue >= ruleValue;
        case 'lte': return comparableCellValue <= ruleValue;
        case 'contains': return String(cellValue).toLowerCase().includes(String(rule.value).toLowerCase());
        case 'not_contains': return !String(cellValue).toLowerCase().includes(String(rule.value).toLowerCase());
        default: return false;
    }
}

const getConditionalClassName = (cellValue: any, header: string, formats: ConditionalFormatRule[]): string => {
    const colorMap: Record<FormattingColor, string> = {
        red: 'bg-red-500/20',
        green: 'bg-green-500/20',
        blue: 'bg-blue-500/20',
        yellow: 'bg-yellow-500/20',
        purple: 'bg-purple-500/20'
    };
    
    const applicableRule = formats.find(rule => rule.column === header && checkCondition(cellValue, rule));
    
    return applicableRule ? colorMap[applicableRule.color] : '';
};


export const DataGrid: React.FC<DataGridProps> = ({ data, fileName, columnSchema, onSort, sortConfig, conditionalFormats }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { headers, rows } = data;

  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, rows.length);
  const visibleRows = rows.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (!headers.length || !rows.length) {
    return <div className="text-center p-8 text-gray-400">No data to display.</div>;
  }
  
  return (
    <div className="bg-gray-950 rounded-lg shadow-lg h-full flex flex-col overflow-hidden border border-gray-800">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
        <div>
            <h2 className="font-bold text-lg text-white truncate max-w-md">{fileName}</h2>
            <p className="text-sm text-gray-400">{rows.length.toLocaleString()} rows &times; {headers.length} columns</p>
        </div>
        {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-2 py-1 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition-colors">&lt;</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 py-1 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition-colors">&gt;</button>
            </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left text-gray-300 table-auto">
          <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 font-mono font-normal text-right w-20 sticky left-0 bg-gray-800">#</th>
              {headers.map((header) => {
                const schema = columnSchema[header];
                return (
                  <th key={header} scope="col" className="px-4 py-3 relative group">
                    <button onClick={() => onSort(header)} className="flex items-center gap-2 w-full text-left font-inherit color-inherit hover:text-white transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{header}</span>
                        {schema && <TypeBadge type={schema.type} />}
                      </div>
                      {sortConfig?.key === header && (
                        sortConfig.direction === SortDirection.Asc 
                            ? <ArrowUpIcon className="w-4 h-4 text-gray-200 shrink-0" /> 
                            : <ArrowDownIcon className="w-4 h-4 text-gray-200 shrink-0" />
                      )}
                    </button>
                     {/* Custom Tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md shadow-lg p-3 z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                      <h4 className="font-bold text-base text-white mb-1">{header}</h4>
                      <p className="text-xs text-gray-400 mb-2 capitalize">{schema?.type || 'string'} Data</p>
                      <div className="border-t border-gray-700 my-2"></div>
                      <p className={`whitespace-normal text-xs leading-relaxed ${schema?.description ? 'text-gray-300' : 'italic text-gray-500'}`}>
                          {schema?.description ? schema.description : 'AI is generating a description...'}
                      </p>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-gray-700"></div>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={startIndex + rowIndex} className="border-b border-gray-800 hover:bg-gray-800/50 group">
                <td className="px-4 py-2 font-mono text-right text-gray-500 sticky left-0 bg-gray-950 group-hover:bg-gray-800/50">{startIndex + rowIndex + 1}</td>
                {headers.map((header) => {
                  const cellValue = row[header];
                  const conditionalClass = getConditionalClassName(cellValue, header, conditionalFormats);
                  return (
                    <td key={header} className={`px-4 py-2 whitespace-nowrap truncate max-w-xs transition-colors ${conditionalClass}`} title={String(cellValue)}>
                      {cellValue === null ? <span className="text-gray-600 italic">null</span> : String(cellValue)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};