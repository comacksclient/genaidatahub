
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
    strategy: 'inner_join' | 'left_join' | 'outer_join' | 'smart_merge'
): MergedData {
    // 1. Normalize all datasets: rename columns to target schema
    const normalizedDatasets = datasets.map(ds => {
        const fileMappings = mappings[ds.fileId] || [];
        const mappingMap = new Map(fileMappings.map(m => [m.sourceColumn, m.targetColumn]));

        const normalizedRows = ds.rows.map(row => {
            const newRow: Record<string, any> = {};
            Object.keys(row).forEach(key => {
                const targetKey = mappingMap.get(key) || key; // Default to original if no mapping
                // Handle conflicts? Last write wins for now within a row, but keys should be unique usually
                newRow[targetKey] = row[key];
            });
            return newRow;
        });

        return { ...ds, rows: normalizedRows };
    });

    // 2. Collect all unique Identifiers based on strategy
    const allIds = new Set<string>();
    const idMap = new Map<string, Record<string, any>>(); // Merged rows

    // Identify the KEY column in the target schema
    // The identifierColumn passed here is the TARGET column name.

    normalizedDatasets.forEach((ds, index) => {
        ds.rows.forEach(row => {
            const idVal = row[identifierColumn];
            if (idVal === undefined || idVal === null || idVal === '') return;
            const idStr = String(idVal);

            if (strategy === 'left_join' && index > 0) {
                // For left join, only add if ID exists (from first dataset)
                // Actually, we build the ID set from the first dataset first.
                return;
            }
            if (strategy === 'inner_join') {
                // Logic for inner join is complex with Set. 
                // We'll handle inner join by filtering later.
                allIds.add(idStr);
            } else {
                allIds.add(idStr);
            }
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
        // outer / smart
        validIds = allIds;
    }

    // 3. Merge Rows
    const mergedRows: Record<string, any>[] = [];
    const allColumns = new Set<string>();

    validIds.forEach(id => {
        let mergedRow: Record<string, any> = { [identifierColumn]: id };

        // Merge in order of datasets
        normalizedDatasets.forEach(ds => {
            const sourceRow = ds.rows.find(r => String(r[identifierColumn]) === id);
            if (sourceRow) {
                mergedRow = { ...mergedRow, ...sourceRow };
            }
        });

        Object.keys(mergedRow).forEach(k => allColumns.add(k));
        mergedRows.push(mergedRow);
    });

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
