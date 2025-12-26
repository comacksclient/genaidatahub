
import { z } from 'zod';

export const CSVUploadSchema = z.object({
    file: z.any(), // In API usually validated via FormData analysis
});

export const ColumnMappingSchema = z.object({
    sourceColumn: z.string(),
    targetColumn: z.string(),
    confidence: z.number().min(0).max(1),
    description: z.string().optional(),
});

export const SchemaMapperResponseSchema = z.object({
    mappings: z.record(z.array(ColumnMappingSchema)),
    commonIdentifiers: z.array(z.string()),
    mergeStrategy: z.enum(['inner_join', 'left_join', 'outer_join', 'smart_merge']),
    reasoning: z.string(),
    targetSchema: z.array(z.string()),
});

export const SchemaMappingRequestSchema = z.object({
    files: z.array(z.object({
        fileId: z.string(),
        name: z.string(),
        headers: z.array(z.string()),
        sampleRows: z.array(z.record(z.any())),
        columnStats: z.array(z.any()).optional(),
    })),
});

export const DataMergeRequestSchema = z.object({
    datasets: z.array(z.object({
        fileId: z.string(),
        rows: z.array(z.record(z.any())),
    })),
    mappings: z.record(z.array(ColumnMappingSchema)),
    identifierColumn: z.string(),
    mergeStrategy: z.enum(['inner_join', 'left_join', 'outer_join', 'smart_merge']),
});

export const AnalysisRequestSchema = z.object({
    data: z.array(z.record(z.any())),
    columns: z.array(z.string()),
    analysisType: z.enum(['general', 'quality', 'correlation']).default('general'),
});

export const DataCleaningOperationSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('remove_rows'),
        rowIndices: z.array(z.number()),
        reason: z.string(),
    }),
    z.object({
        type: z.literal('rename_column'),
        originalName: z.string(),
        newName: z.string(),
    }),
    z.object({
        type: z.literal('fill_missing'),
        column: z.string(),
        value: z.any(),
        strategy: z.enum(['mean', 'median', 'mode', 'fixed']),
    }),
]);
