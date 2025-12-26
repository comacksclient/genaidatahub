
'use client';

import React from 'react';
import { MergedData } from '@/types';
import { Download } from 'lucide-react';
import { exportToCSV } from '@/lib/data-merger';

interface DataWorkbenchProps {
    mergedData: MergedData;
    onExport?: () => void;
}

export default function DataWorkbench({ mergedData }: DataWorkbenchProps) {
    const downloadCSV = () => {
        const csv = exportToCSV(mergedData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `merged_data_${new Date().getTime()}.csv`;
        a.click();
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Merged Data Preview</h3>
                <button
                    onClick={downloadCSV}
                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                {mergedData.columns.map((col) => (
                                    <th key={col} className="px-6 py-3 font-medium whitespace-nowrap">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {mergedData.rows.slice(0, 10).map((row, i) => (
                                <tr key={i} className="bg-white hover:bg-slate-50">
                                    {mergedData.columns.map((col) => (
                                        <td key={`${i}-${col}`} className="px-6 py-4 text-slate-700 whitespace-nowrap">
                                            {row[col] === null || row[col] === undefined ?
                                                <span className="text-slate-300 italic">null</span> :
                                                String(row[col])
                                            }
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
                    Showing first 10 rows of {mergedData.metadata.totalRows} total rows.
                </div>
            </div>
        </div>
    );
}
