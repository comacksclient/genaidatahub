
import { MergedData, ColumnMapping } from "@/types";
import Papa from 'papaparse';

interface Dataset {
    fileId: string;
    rows: Record<string, any>[];
}

export function mergeDatasets(
    datasets: Dataset[],
    mappings: Record<string, ColumnMapping[]>,
    identifierColumn: string,
    strategy: 'inner_join' | 'left_join' | 'outer_join' | 'smart_merge',
    targetSchema?: string[]
): MergedData {
    // 1. Normalize all datasets: rename columns to target schema
    const normalizedDatasets = datasets.map(ds => {
        const fileMappings = mappings[ds.fileId] || [];
        const mappingMap = new Map(fileMappings.map(m => [m.sourceColumn, m.targetColumn]));

        const normalizedRows = ds.rows.map(row => {
            const newRow: Record<string, any> = {};
            Object.keys(row).forEach(key => {
                const targetKey = mappingMap.get(key) || key;
                // Only include if it's in targetSchema (if provided)
                if (targetSchema && !targetSchema.includes(targetKey)) {
                    return;
                }
                newRow[targetKey] = row[key];
            });
            return newRow;
        });

        return { ...ds, rows: normalizedRows };
    });

    // 2. Collect all unique Identifiers based on strategy
    const allIds = new Set<string>();

    normalizedDatasets.forEach((ds, index) => {
        ds.rows.forEach(row => {
            const idVal = row[identifierColumn];
            if (idVal === undefined || idVal === null || idVal === '') return;
            const idStr = String(idVal);

            if (strategy === 'left_join' && index > 0) return;
            allIds.add(idStr);
        });
    });

    let validIds: Set<string>;

    if (strategy === 'left_join') {
        validIds = new Set();
        normalizedDatasets[0].rows.forEach(r => {
            const v = r[identifierColumn];
            if (v) validIds.add(String(v));
        });
    } else if (strategy === 'inner_join') {
        // Intersection of all ID sets
        const sets = normalizedDatasets.map(ds => {
            const s = new Set<string>();
            ds.rows.forEach(r => { if (r[identifierColumn]) s.add(String(r[identifierColumn])); });
            return s;
        });
        validIds = sets.reduce((a, b) => {
            const intersection = new Set<string>();
            for (const item of a) if (b.has(item)) intersection.add(item);
            return intersection;
        }, sets[0] || new Set());
    } else {
        validIds = allIds;
    }

    // 3. Merge Rows
    const mergedRows: Record<string, any>[] = [];
    const allColumns = new Set<string>();

    // If targetSchema provided, initialize allColumns with it
    if (targetSchema) {
        targetSchema.forEach(c => allColumns.add(c));
    }

    let rowIndex = 1;

    validIds.forEach(id => {
        let mergedRow: Record<string, any> = { [identifierColumn]: id };

        // Merge in order of datasets
        normalizedDatasets.forEach(ds => {
            const sourceRow = ds.rows.find(r => String(r[identifierColumn]) === id);
            if (sourceRow) {
                mergedRow = { ...mergedRow, ...sourceRow };
            }
        });

        // Strict filtering & Filling missing values
        const finalRow: Record<string, any> = { _row_index: rowIndex++ }; // Add row index

        const outputColumns = targetSchema ? targetSchema : Object.keys(mergedRow);

        outputColumns.forEach(col => {
            // Fill missing values with empty string to ensure CSV structure
            const val = mergedRow[col];
            finalRow[col] = (val === undefined || val === null) ? "" : val;
            if (!targetSchema) allColumns.add(col);
        });

        mergedRows.push(finalRow);
    });

    // Ensure _row_index is first
    const finalColumns = ['_row_index', ...(targetSchema || Array.from(allColumns).sort())];

    return {
        columns: finalColumns,
        rows: mergedRows,
        metadata: {
            totalRows: mergedRows.length,
            sources: datasets.map(d => d.fileId),
            generatedAt: new Date().toISOString(),
            mergeStrategy: strategy,
            joinKey: identifierColumn
        }
    };
}

export function exportToCSV(data: MergedData): string {
    return Papa.unparse(data.rows, {
        columns: data.columns, // Use strict column order from metadata
        header: true,
        skipEmptyLines: true
    });
}
