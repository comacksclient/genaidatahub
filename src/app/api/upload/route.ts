
import { NextRequest, NextResponse } from 'next/server';
import { parseCSVFile } from '@/lib/csv-parser';
import { CSVUploadSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { error: 'No valid file provided' },
                { status: 400 }
            );
        }

        // Validate size?
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            return NextResponse.json(
                { error: 'File size too large (max 10MB)' },
                { status: 400 }
            );
        }

        const text = await file.text();
        const uploadedFile = await parseCSVFile(text, file.name);

        // In a real app, we might save the file to S3/Blob storage here and return the ID.
        // For this assignment, we return the parsed metadata and content (in sampleRows)
        // We avoid returning full content to keep payload small, but for simple merge, we might need it.
        // The client handles state in this simple version.

        return NextResponse.json(uploadedFile);

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: 'Failed to process file' },
            { status: 500 }
        );
    }
}
