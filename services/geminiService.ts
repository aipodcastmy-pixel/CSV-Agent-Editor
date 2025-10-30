import { GoogleGenAI, Type } from '@google/genai';
import { Step, Operation, SortDirection } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // In a real app, you'd handle this more gracefully.
  // For this context, we assume the key is provided.
  console.warn("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        op: {
            type: Type.STRING,
            enum: Object.values(Operation),
            description: 'The operation to perform.',
        },
        params: {
            type: Type.OBJECT,
            description: 'Parameters for the operation. Varies by operation type.',
            properties: {
                // For filter & conditional_format
                column: { type: Type.STRING, description: "Column to filter or format on." },
                condition: { type: Type.STRING, enum: ['equals', 'not_equals', 'gt', 'lt', 'gte', 'lte', 'contains', 'not_contains'], description: "The condition." },
                value: { type: Type.STRING, description: "The value for the condition." },
                
                // For sort
                columns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of columns to sort by." },
                directions: { type: Type.ARRAY, items: { type: Type.STRING, enum: Object.values(SortDirection) }, description: "Sort directions (asc/desc) for each column." },

                // For dedupe
                keys: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Columns to determine uniqueness." },

                // For remove_column
                column_to_remove: { type: Type.STRING, description: "The name of the column to remove." },

                // For rename_column
                old_name: { type: Type.STRING, description: "The current name of the column." },
                new_name: { type: Type.STRING, description: "The new name for the column." },
                
                // For fill_na
                fill_column: { type: Type.STRING, description: "Column with missing values to fill." },
                fill_value: { type: Type.STRING, description: "Value to fill missing data with." },

                // For conditional_format
                color: { type: Type.STRING, enum: ['red', 'green', 'blue', 'yellow', 'purple'], description: "The color to highlight the cells."},
                
                // For error
                message: {type: Type.STRING, description: "Explanation of why the command could not be understood."},
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3-4 suggested commands the user could try."}
            }
        },
        explanation: {
            type: Type.STRING,
            description: 'A brief, user-friendly explanation of the operation being performed.',
        }
    }
};

export const parseCommand = async (command: string, headers: string[]): Promise<Step> => {
    const systemInstruction = `You are a helpful and proactive data analysis agent. Your task is to convert natural language commands into a structured JSON format for processing CSV data. 
    The available columns in the CSV are: ${headers.join(', ')}.
    Analyze the user's command and generate a JSON object that matches the provided schema.
    - You can also apply conditional formatting. For example: "highlight cells in 'price' column green where value is > 50". Supported colors are red, green, blue, yellow, purple.
    - Be precise with column names.
    - If the user's command is concrete and clear, generate the corresponding operation.
    - If the user's command is ambiguous, vague, or incomplete (e.g., "clean the data", "make it look good"), DO NOT just say it's ambiguous. Instead, use the 'error' operation, provide a helpful message explaining what is needed, AND suggest 3-4 concrete, actionable commands the user could try based on the dataset's columns. Use the 'suggestions' field for this.
    - For sorting, if no direction is specified, default to 'asc'.
    - For filtering, infer the condition ('equals', 'gt', 'lt', etc.) from the user's language.
    - Provide a concise, human-readable 'explanation' of the action.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Command: "${command}"`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);

        // Basic validation
        if (!parsedJson.op || !Object.values(Operation).includes(parsedJson.op)) {
            throw new Error('Invalid or missing operation in AI response.');
        }

        return parsedJson as Step;

    } catch (error) {
        console.error("Error parsing command with Gemini:", error);
        
        let userMessage = "Sorry, I encountered an issue processing your request. Please try rephrasing.";

        if (error instanceof Error) {
            if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
                userMessage = "You have exceeded your API quota. Please wait a moment before trying again or check your billing details on the Google AI Platform.";
            } else if (error.message.includes('API_KEY_INVALID')) {
                 userMessage = "The provided API key is invalid. Please check your configuration.";
            } else {
                // Keep it clean for the user, but devs can see the console.
                userMessage = `An error occurred while communicating with the AI. Please check the console for details.`;
            }
        }

        return {
            op: Operation.Error,
            params: { message: userMessage },
            explanation: "Failed to process the command."
        };
    }
};


const descriptionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            columnName: { type: Type.STRING, description: 'The name of the column header.' },
            description: { type: Type.STRING, description: 'A concise, one-sentence description of the column.' }
        },
        required: ['columnName', 'description']
    }
};

export const generateColumnDescriptions = async (headers: string[], rows: Record<string, any>[]): Promise<Record<string, string>> => {
    const sample = rows.slice(0, 5).map(row => headers.map(h => row[h]));

    const systemInstruction = `You are a helpful data analyst. Your task is to generate a concise, one-sentence description for each column in a CSV file based on its name and a sample of its data.
    The response must be a JSON array of objects, where each object contains "columnName" and "description" keys.
    The description should explain the likely purpose or content of the column.
    Do not add any extra text or explanation outside of the JSON array.`;

    const contents = `Column Headers: ${JSON.stringify(headers)}\nData Sample (rows):\n${JSON.stringify(sample)}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: descriptionSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson: { columnName: string, description: string }[] = JSON.parse(jsonText);

        const descriptions: Record<string, string> = {};
        for (const item of parsedJson) {
            if (headers.includes(item.columnName)) {
                descriptions[item.columnName] = item.description;
            }
        }
        return descriptions;

    } catch (error) {
        console.error("Error generating column descriptions with Gemini:", error);
        return {};
    }
};
