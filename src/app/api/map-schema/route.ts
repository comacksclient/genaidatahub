import { NextRequest, NextResponse } from 'next/server';
import { generateSchemaMappings } from '@/lib/llm';
import { SchemaMappingRequestSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const validation = SchemaMappingRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid request data', details: validation.error },
                { status: 400 }
            );
        }

        const { files } = validation.data;

        if (files.length < 2) {
            return NextResponse.json(
                { error: 'At least 2 files are required for mapping' },
                { status: 400 }
            );
        }


        const filesForAI = files.map(f => ({
            ...f,
            totalRows: 0,
            quality: 100
        }));

        const mappings = await generateSchemaMappings(filesForAI);
        return NextResponse.json(mappings);

    } catch (error) {
        console.error("Mapping error:", error);
        return NextResponse.json(
            { error: 'Failed to generate mappings' },
            { status: 500 }
        );
    }
}