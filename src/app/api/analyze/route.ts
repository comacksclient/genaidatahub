
import { NextRequest, NextResponse } from 'next/server';
import { generateInsights } from '@/lib/llm';
import { AnalysisRequestSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const validation = AnalysisRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid analysis request', details: validation.error },
                { status: 400 }
            );
        }

        const { data, columns } = validation.data;

        // Limit data size for LLM protection if not handled in lib
        const limitedData = data.slice(0, 100);

        const result = await generateInsights(limitedData, columns);
        return NextResponse.json(result);

    } catch (error) {
        console.error("Analysis error:", error);
        return NextResponse.json(
            { error: 'Failed to analyze data' },
            { status: 500 }
        );
    }
}
