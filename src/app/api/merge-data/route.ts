
import { NextRequest, NextResponse } from 'next/server';
import { mergeDatasets, exportToCSV } from '@/lib/data-merger';
import { DataMergeRequestSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const validation = DataMergeRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid merge request', details: validation.error },
                { status: 400 }
            );
        }

        const { datasets, mappings, identifierColumn, mergeStrategy } = validation.data;

        const mergedData = mergeDatasets(datasets, mappings, identifierColumn, mergeStrategy);

        // Support CSV download via query param or generic response
        // For now returning JSON MergedData structure as per requirements mostly for API usage

        return NextResponse.json(mergedData);

    } catch (error) {
        console.error("Merge error:", error);
        return NextResponse.json(
            { error: 'Failed to merge datasets' },
            { status: 500 }
        );
    }
}
