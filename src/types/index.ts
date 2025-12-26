
export interface UploadedFile {
    fileId: string;
    name: string;
    headers: string[];
    sampleRows: Record<string, any>[];
    rows?: Record<string, any>[];
    totalRows: number;
    quality: number;
    suggestedIdentifier?: string;
    issues?: string[];
    columnStats?: ColumnStats[];
}

export interface ColumnStats {
    column: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'phone' | 'null';
    uniqueCount: number;
    nullCount: number;
    exampleValues: any[];
}

export interface ColumnMapping {
    sourceColumn: string;
    targetColumn: string;
    confidence: number;
    description?: string;
}

export interface SchemaMapperResponse {
    mappings: Record<string, ColumnMapping[]>; // keyed by fileId
    commonIdentifiers: string[];
    mergeStrategy: 'inner_join' | 'left_join' | 'outer_join' | 'smart_merge';
    reasoning: string;
    targetSchema: string[];
}

export interface MergedData {
    columns: string[];
    rows: Record<string, any>[];
    metadata: {
        totalRows: number;
        sources: string[];
        generatedAt: string;
        mergeStrategy: string;
        joinKey: string;
    };
}

export interface Insight {
    type: 'trend' | 'outlier' | 'pattern' | 'summary';
    title: string;
    description: string;
    significance: 'high' | 'medium' | 'low';
}

export interface Anomaly {
    rowId: number | string;
    column: string;
    value: any;
    reason: string;
    severity: 'critical' | 'warning' | 'info';
}

export interface Recommendation {
    action: 'filter' | 'clean' | 'augment' | 'visualize';
    description: string;
    impact: 'high' | 'medium' | 'low';
}

export interface Correlation {
    columnA: string;
    columnB: string;
    coefficient: number; // -1 to 1
    description: string;
}

export interface AnalysisResult {
    insights: Insight[];
    anomalies: Anomaly[];
    recommendations: Recommendation[];
    correlations: Correlation[];
    summary: string;
}

export type ProcessingStatus = 'idle' | 'uploading' | 'analyzing' | 'mapping' | 'merging' | 'completed' | 'error';
