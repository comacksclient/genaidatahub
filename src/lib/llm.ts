
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

import {
    SchemaMapperResponse,
    AnalysisResult,

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
            apiKey: apiKey,
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
        model: "gemini-1.5-pro", // FIXED: Changed 'modelName' to 'model'
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
        template: `You are a Dental Data Architect and Lead Enrichment Specialist. 
    You are merging disparate datasets from various dental clinics to build a Master Growth Database.
    
    Your priority is to consolidate Patient/Lead identities and Clinic Growth Metrics.

    Input Files:
    {files}

    ---
    
    CRITICAL MAPPING RULES:
    1. **Identity Resolution**: Aggressively look for contact markers. Map 'Cell', 'Mobile', 'Ph', 'Contact' -> 'phone_number'. Map 'E-mail', 'Email Addr' -> 'email'.
    2. **Name Normalization**: If you see 'First Name'/'Last Name' in one file and 'Full Name' in another, suggest a mapping to 'full_name' (note: requires concatenation).
    3. **Growth Metrics**: prioritize columns related to revenue ('Production', 'Collection', 'Amount'), appointments ('Appt Date', 'Visit'), and status ('New Patient', 'Active', 'Archived').
    4. **Junk Removal**: Ignore internal system columns like 'DB_ID_99', 'Row_Hash', or empty spacers.

    GOALS:
    1. **Mappings**: Create a unified schema focusing on: [Patient_ID, Name, Phone, Email, Last_Visit_Date, Treatment_Value, Lead_Source, Clinic_Name].
    2. **Join Strategy**: Identify the best key to join specific patients across files (usually Email or Phone). If joining distinct clinics, use 'Smart Append'.
    3. **Target Schema**: Define a clean, flat schema ready for a CRM import.

    {format_instructions}

    Analyze the headers and sample rows deeply. Return pure JSON.
    `,
        inputVariables: ["files"],
        partialVariables: { format_instructions: formatInstructions },
    });

    const input = await prompt.format({
        files: JSON.stringify(fileSummaries, null, 2)
    });

    try {


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



    const sampleSize = 50;
    const sampledData = data.slice(0, sampleSize);

    const prompt = `
    You are an Elite Dental Business Analyst and Growth Strategist. 
    Your goal is to audit this dataset to find "Hidden Revenue," "Lead Quality Issues," and "Operational Trends."

    CONTEXT: 
    This data comes from Dental Clinics (Patient lists, Production reports, or Marketing Leads).
    
    INPUT DATA:
    - Columns: ${columns.join(', ')}
    - Data Sample: ${JSON.stringify(sampledData)}

    INSTRUCTIONS:
    Analyze the data to generate a JSON report. Focus strictly on these pillars:
    
    1. **INSIGHTS** (Focus on Growth & Retention):
       - Look for High-Value Patient trends (e.g., Implants/Ortho vs. General Hygiene).
       - Identify "Recall Opportunities" (patients with old dates).
       - Analyze Lead Source performance if available.

    2. **ANOMALIES** (Focus on Data Hygiene):
       - Flag invalid phone numbers (e.g., length != 10, "555-5555").
       - Flag missing emails in high-value rows.
       - Flag zero-dollar production where it shouldn't exist.

    3. **RECOMMENDATIONS** (Actionable Growth Tactics):
       - Suggest specific campaigns (e.g., "Reactivation Campaign for 50+ inactive patients").
       - Suggest data cleanup tasks.

    4. **CORRELATIONS**:
       - Does specific Treatment Type correlate with higher Cancellations?
       - Does Lead Source correlate with specific Zip Codes?

    --------------------------------------------------------
    RESPONSE FORMAT (Strict JSON, no markdown, no prose):
    {
      "insights": [ 
        { "type": "positive" | "negative" | "neutral", "title": "Short Headline", "description": "Detailed business implication", "significance": "High" | "Medium" | "Low" } 
      ],
      "anomalies": [ 
        { "rowId": "ID or Index", "column": "Column Name", "value": "The bad value", "reason": "Why it is bad", "severity": "Critical" | "Warning" } 
      ],
      "recommendations": [ 
        { "action": "Specific Task", "description": "How to execute", "impact": "Estimated Revenue/Efficiency Gain" } 
      ],
      "correlations": [ 
        { "columnA": "Name", "columnB": "Name", "coefficient": "Strong/Weak/Negative", "description": "Business interpretation" } 
      ],
      "summary": "A professional executive summary of the clinic's data health and growth potential."
    }
    `;

    try {
        const res = await llm.invoke(prompt);
        const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);


        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as AnalysisResult;
    } catch (e) {
        console.error("LLM Analysis Error", e);

        return {
            insights: [],
            anomalies: [],
            recommendations: [],
            correlations: [],
            summary: "Analysis failed due to LLM error."
        };
    }
}
