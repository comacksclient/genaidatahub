
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

import {
    SchemaMapperResponse,
    AnalysisResult,
    ColumnMapping
} from "@/types";

import {
    SchemaMapperResponseSchema as ZodSchemaResponse,
} from "./schemas";
import { UploadedFile } from "@/types";

const getType = () => {
    if (process.env.NEXT_PUBLIC_LLM_PROVIDER) return process.env.NEXT_PUBLIC_LLM_PROVIDER;
    if (process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY) return 'openrouter';
    return 'gemini';
};

const getLLM = () => {
    const type = getType();

    if (type === 'openrouter') {
        const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error("Missing OPENROUTER_API_KEY in environment variables");
        }

        return new ChatOpenAI({
            modelName: 'deepseek/deepseek-chat',
            temperature: 0,
            apiKey: apiKey, // Use 'apiKey' for newer langchain versions, fallback handled internally
            configuration: {
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    "HTTP-Referer": "https://localhost:3000",
                    "X-Title": "GenAI Data Hub",
                }
            },
        });
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.warn("No API Key found for LLM. Please set NEXT_PUBLIC_GEMINI_API_KEY or OPENAI_API_KEY");
    }

    if (type === 'openai') {
        const key = process.env.OPENAI_API_KEY;
        if (!key) throw new Error("Missing OPENAI_API_KEY");
        return new ChatOpenAI({
            openAIApiKey: key,
            modelName: 'gpt-4-turbo',
            temperature: 0,
        });
    }

    // Default to Gemini
    return new ChatGoogleGenerativeAI({
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
        modelName: "gemini-1.5-pro",
        maxOutputTokens: 2048,
        temperature: 0.1,
    });
};

export async function generateSchemaMappings(files: UploadedFile[]): Promise<SchemaMapperResponse> {
    const llm = getLLM();
    const parser = StructuredOutputParser.fromZodSchema(ZodSchemaResponse as any);
    const formatInstructions = parser.getFormatInstructions();

    const fileSummaries = files.map(f => ({
        id: f.fileId,
        name: f.name,
        headers: f.headers,
        sample: f.sampleRows.slice(0, 2),
        stats: f.columnStats?.map(c => ({ col: c.column, type: c.type, unique: c.uniqueCount }))
    }));

    const prompt = new PromptTemplate({
        template: `You are an expert Data Engineer. Analyze the following CSV schemas and suggest how to merge them.
        
        Files:
        {files}

        Goals:
        1. Identify equivalent columns across files (mappings).
        2. Identify the best common identifier to join on.
        3. Suggest a merge strategy (inner, left, outer, smart).
        4. Define a unified target schema. Ensure no duplicate columns.

        {format_instructions}
        
        Provide the response in pure JSON.
        `,
        inputVariables: ["files"],
        partialVariables: { format_instructions: formatInstructions },
    });

    const input = await prompt.format({
        files: JSON.stringify(fileSummaries, null, 2)
    });

    try {

        // But ChatModel returns a BaseMessage.
        const res = await llm.invoke(input);
        const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);

        const parsed = await parser.parse(text);
        return parsed as SchemaMapperResponse;
    } catch (e) {
        console.error("LLM Schema Mapping Error", e);
        throw new Error("Failed to generate schema mappings via AI");
    }
}

export async function generateInsights(
    data: Record<string, any>[],
    columns: string[]
): Promise<AnalysisResult> {
    const llm = getLLM();

    // Simplification: Sending sample data to LLM to get insights
    // In production, we'd calculate stats first and send stats.

    const sampleSize = 50;
    const sampledData = data.slice(0, sampleSize);

    const prompt = `
    Analyze this dataset excerpt and provide Data Intelligence insights.
    Columns: ${columns.join(', ')}
    Data Sample (first ${sampleSize} rows): ${JSON.stringify(sampledData)}
    
    Return a JSON object with:
    - insights: array of { type, title, description, significance }
    - anomalies: array of { rowId, column, value, reason, severity }
    - recommendations: array of { action, description, impact }
    - correlations: array of { columnA, columnB, coefficient, description }
    - summary: string
    
    Respond ONLY with valid JSON.
    `;

    try {
        const res = await llm.invoke(prompt);
        const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);

        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as AnalysisResult;
    } catch (e) {
        console.error("LLM Analysis Error", e);
        // Fallback or empty result
        return {
            insights: [],
            anomalies: [],
            recommendations: [],
            correlations: [],
            summary: "Analysis failed due to LLM error."
        };
    }
}
