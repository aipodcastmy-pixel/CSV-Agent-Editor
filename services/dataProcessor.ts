
import { TableData, Step, PreviewResult, Operation, SortDirection } from '../types';
import { cloneDeep } from 'lodash'; // Using a helper for deep cloning to ensure data immutability

const isNumeric = (val: any): boolean => !isNaN(parseFloat(val)) && isFinite(val);

export const previewStep = (data: TableData, step: Step): PreviewResult => {
    const originalRowCount = data.rows.length;
    const processedData = applyStep(data, step);
    const newRowCount = processedData.rows.length;

    const diff = {
        rowsAdded: Math.max(0, newRowCount - originalRowCount),
        rowsRemoved: Math.max(0, originalRowCount - newRowCount),
        rowsModified: 0, // Simplified for now
    };

    // Generate a simple sample diff
    const sample = [];
    if (diff.rowsRemoved > 0) {
        const removedSample = data.rows.filter(
            (originalRow) => !processedData.rows.some(
                (newRow) => JSON.stringify(newRow) === JSON.stringify(originalRow)
            )
        ).slice(0, 3).map(r => ({ ...r, __status: 'removed' }));
        sample.push(...removedSample);
    }
    if (diff.rowsAdded > 0) {
         const addedSample = processedData.rows.filter(
            (newRow) => !data.rows.some(
                (originalRow) => JSON.stringify(newRow) === JSON.stringify(originalRow)
            )
        ).slice(0, 3).map(r => ({ ...r, __status: 'added' }));
        sample.push(...addedSample);
    }
    
    // Fallback sample if no adds/removes
    if (sample.length === 0 && processedData.rows.length > 0) {
        sample.push(...processedData.rows.slice(0,3).map(r => ({...r, __status: 'unmodified'})));
    }


    return { diff, sample };
};


export const applyStep = (data: TableData, step: Step): TableData => {
  // Use deep cloning to avoid mutating the original state
  const newData = cloneDeep(data);

  switch (step.op) {
    case Operation.Filter: {
        const { column, condition, value } = step.params;
        if (!newData.headers.includes(column)) return newData;
        
        newData.rows = newData.rows.filter(row => {
            const rowValue = row[column];
            const filterValue = isNumeric(value) ? parseFloat(value as string) : value;
            const comparableRowValue = isNumeric(rowValue) ? parseFloat(rowValue) : rowValue;

            switch (condition) {
                case 'equals': return comparableRowValue == filterValue;
                case 'not_equals': return comparableRowValue != filterValue;
                case 'gt': return comparableRowValue > filterValue;
                case 'lt': return comparableRowValue < filterValue;
                case 'gte': return comparableRowValue >= filterValue;
                case 'lte': return comparableRowValue <= filterValue;
                case 'contains': return String(rowValue).toLowerCase().includes(String(value).toLowerCase());
                case 'not_contains': return !String(rowValue).toLowerCase().includes(String(value).toLowerCase());
                default: return true;
            }
        });
        break;
    }
    case Operation.Sort: {
        const { columns, directions } = step.params;
        newData.rows.sort((a, b) => {
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const dir = directions[i] === SortDirection.Desc ? -1 : 1;
                const valA = a[col];
                const valB = b[col];

                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
            }
            return 0;
        });
        break;
    }
    case Operation.Dedupe: {
        const { keys } = step.params;
        const seen = new Set();
        newData.rows = newData.rows.filter(row => {
            const key = keys.map(k => row[k]).join('||');
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
        break;
    }
    case Operation.RemoveColumn: {
        const { column_to_remove } = step.params;
        if (newData.headers.includes(column_to_remove)) {
            newData.headers = newData.headers.filter(h => h !== column_to_remove);
            newData.rows.forEach(row => delete row[column_to_remove]);
        }
        break;
    }
    case Operation.RenameColumn: {
        const { old_name, new_name } = step.params;
        const index = newData.headers.indexOf(old_name);
        if (index !== -1) {
            newData.headers[index] = new_name;
            newData.rows.forEach(row => {
                row[new_name] = row[old_name];
                delete row[old_name];
            });
        }
        break;
    }
    case Operation.FillNA: {
        const { fill_column, fill_value } = step.params;
        if (newData.headers.includes(fill_column)) {
            newData.rows.forEach(row => {
                if (row[fill_column] === null || row[fill_column] === undefined || row[fill_column] === '') {
                    row[fill_column] = isNumeric(fill_value) ? parseFloat(fill_value as string) : fill_value;
                }
            });
        }
        break;
    }
    case Operation.Error:
        // Do nothing for error operation
        break;
    default:
        console.warn(`Unknown operation: ${step.op}`);
  }
  return newData;
};
