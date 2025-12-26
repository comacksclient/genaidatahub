
import Papa from 'papaparse';
import { UploadedFile, ColumnStats } from '@/types';

export async function parseCSVFile(
    fileContent: string | File,
    fileName: string
): Promise<UploadedFile> {
    const fileId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn('CSV Parse Warnings:', results.errors);
                }

                const rows = results.data as Record<string, any>[];
                const headers = results.meta.fields || [];
                const totalRows = rows.length;
                const sampleRows = rows.slice(0, 5);

                const columnStats = analyzeColumns(rows, headers);
                const { quality, issues } = validateCSVQuality(rows, headers, columnStats);
                const suggestedIdentifier = findIdentifierColumns(headers, columnStats);

                resolve({
                    fileId,
                    name: fileName,
                    headers,
                    sampleRows,
                    rows,
                    totalRows,
                    quality,
                    issues,
                    columnStats,
                    suggestedIdentifier
                });
            },
            error: (error: any) => reject(error)
        });
    });
}

export function analyzeColumns(rows: any[], headers: string[]): ColumnStats[] {
    return headers.map(header => {
        const values = rows.map(r => r[header]);
        const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
        const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
        const uniqueCount = new Set(nonNullValues).size;

        // Simple type detection based on majority
        const type = detectDataType(nonNullValues);

        return {
            column: header,
            type,
            uniqueCount,
            nullCount,
            exampleValues: nonNullValues.slice(0, 3)
        };
    });
}

export function detectDataType(values: any[]): ColumnStats['type'] {
    if (values.length === 0) return 'null';

    const types = values.map(v => {
        if (typeof v === 'boolean') return 'boolean';
        if (typeof v === 'number') return 'number';
        if (v instanceof Date) return 'date';

        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'date';
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'email';
        if (/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(s)) return 'phone';
        return 'string';
    });

    // Return the most frequent type
    const counts = types.reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as any;
}

export function findIdentifierColumns(headers: string[], stats: ColumnStats[]): string | undefined {
    // Priority 1: High uniqueness + common ID names
    const idCandidates = stats.filter(s => s.uniqueCount > s.exampleValues.length * 0.9 || /id|code|key|no\./i.test(s.column));

    // Look for specific named columns first
    const specific = idCandidates.find(c => /email|phone|ssn|uuid/i.test(c.column));
    if (specific) return specific.column;

    // Look for generic 'id'
    const genericId = idCandidates.find(c => /id/i.test(c.column));
    if (genericId) return genericId.column;

    // Fallback to first high-uniqueness column
    return idCandidates[0]?.column;
}

export function validateCSVQuality(rows: any[], headers: string[], stats: ColumnStats[]): { quality: number, issues: string[] } {
    let score = 100;
    const issues: string[] = [];

    // Check for empty headers
    if (headers.length === 0) {
        score -= 100;
        issues.push("File has no headers");
        return { quality: score, issues };
    }

    // Check data density
    const nullRates = stats.map(s => s.nullCount / (rows.length || 1));
    const avgNullRate = nullRates.reduce((a, b) => a + b, 0) / nullRates.length;

    if (avgNullRate > 0.5) {
        score -= 20;
        issues.push("High number of missing values (>50%)");
    } else if (avgNullRate > 0.1) {
        score -= 5;
        issues.push("Some missing values detected");
    }

    // Check for duplicate rows (simple check on stringified row)
    // Optimization: only check small sample or rely on ids

    // Check identifier existence
    const hasIdentifier = stats.some(s => s.uniqueCount === rows.length);
    if (!hasIdentifier && rows.length > 0) {
        score -= 10;
        issues.push("No clear unique identifier column found");
    }

    return { quality: Math.max(0, score), issues };
}
