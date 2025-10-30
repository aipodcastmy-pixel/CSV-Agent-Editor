export type ColumnType = 'string' | 'number' | 'date' | 'boolean';

export interface ColumnInfo {
  type: ColumnType;
  description?: string;
}

export interface ColumnSchema {
  [header: string]: ColumnInfo;
}

export interface TableData {
  headers: string[];
  rows: Record<string, any>[];
}

export enum AgentStatus {
  Idle = 'idle',
  Interpreting = 'interpreting',
  Previewing = 'previewing',
  AwaitingConfirmation = 'awaiting_confirmation',
  Applying = 'applying',
}

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  suggestions?: string[];
}

export enum Operation {
  Filter = 'filter',
  Sort = 'sort',
  Dedupe = 'dedupe',
  RemoveColumn = 'remove_column',
  RenameColumn = 'rename_column',
  FillNA = 'fill_na',
  ConditionalFormat = 'conditional_format',
  Error = 'error',
}

export enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}

export type SortConfig = {
  key: string;
  direction: SortDirection;
} | null;

export interface Step {
  op: Operation;
  params: any;
  explanation: string;
}

export interface PreviewDiff {
  rowsAdded: number;
  rowsRemoved: number;
  rowsModified: number;
}

export interface PreviewResult {
  diff: PreviewDiff;
  sample: Record<string, any>[];
}

export interface PreviewData {
  step: Step;
  diff: PreviewDiff;
  sample: Record<string, any>[];
}

export type FormattingColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple';

export interface ConditionalFormatRule {
  id: string;
  column: string;
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'equals' | 'not_equals' | 'contains' | 'not_contains';
  value: any;
  color: FormattingColor;
}
