
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
    strategy: 'inner_join' | 'left_join' | 'outer_join' | 'smart_merge' | 'append',
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

    // Identify the KEY column in the target schema
    // The identifierColumn passed here is the TARGET column name.

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

    // If targetSchema provided, initialize allColumns with it to ensure order and completeness
    if (targetSchema) {
        targetSchema.forEach(c => allColumns.add(c));
    }

    if (strategy === 'append') {
        // Append Mode: Stack rows
        normalizedDatasets.forEach(ds => {
            ds.rows.forEach(row => {
                let finalRow = { ...row };

                // Enforce schema
                if (targetSchema) {
                    const filteredRow: Record<string, any> = {};
                    targetSchema.forEach(col => {
                        filteredRow[col] = finalRow[col] ?? null;
                    });
                    finalRow = filteredRow;
                } else {
                    Object.keys(finalRow).forEach(k => allColumns.add(k));
                }
                mergedRows.push(finalRow);
            });
        });
    } else {
        // Join Modes
        validIds.forEach(id => {
            let mergedRow: Record<string, any> = { [identifierColumn]: id };

            // Merge in order of datasets
            normalizedDatasets.forEach(ds => {
                const sourceRow = ds.rows.find(r => String(r[identifierColumn]) === id);
                if (sourceRow) {
                    mergedRow = { ...mergedRow, ...sourceRow };
                }
            });

            // Strict filtering of the final row keys (double check)
            if (targetSchema) {
                const filteredRow: Record<string, any> = {};
                targetSchema.forEach(col => {
                    filteredRow[col] = mergedRow[col] ?? null;
                });
                mergedRow = filteredRow;
            } else {
                Object.keys(mergedRow).forEach(k => allColumns.add(k));
            }

            mergedRows.push(mergedRow);
        });
    }

    return {
        columns: Array.from(allColumns),
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
        columns: data.columns,
        header: true
    });
}
