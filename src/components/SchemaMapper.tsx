
'use client';

import React, { useState, useEffect } from 'react';
import { UploadedFile, SchemaMapperResponse, ColumnMapping } from '@/types';
import { Loader2, ArrowRight, Wand2, RefreshCw, Layers, Plus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchemaMapperProps {
    files: UploadedFile[];
    onMappingComplete: (response: SchemaMapperResponse) => void;
}

export default function SchemaMapper({ files, onMappingComplete }: SchemaMapperProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // State for the Mapping Editor
    const [targetSchema, setTargetSchema] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, ColumnMapping[]>>({});
    const [mergeStrategy, setMergeStrategy] = useState<'inner_join' | 'left_join' | 'outer_join' | 'smart_merge'>('outer_join');
    const [commonIdentifier, setCommonIdentifier] = useState<string>('');

    // Initialize with naive mappings (all columns)
    useEffect(() => {
        if (targetSchema.length === 0 && files.length > 0) {
            const initialSchema = new Set<string>();
            const initialMappings: Record<string, ColumnMapping[]> = {};
            let potentialId = '';

            files.forEach(f => {
                if (f.suggestedIdentifier && !potentialId) potentialId = f.suggestedIdentifier;
                f.headers.forEach(h => initialSchema.add(h));
                initialMappings[f.fileId] = [];
            });

            const schemaArray = Array.from(initialSchema);
            setTargetSchema(schemaArray);
            setCommonIdentifier(potentialId || 'id');

            // Naive 1-to-1 mapping
            files.forEach(f => {
                const fileMaps: ColumnMapping[] = [];
                schemaArray.forEach(target => {
                    if (f.headers.includes(target)) {
                        fileMaps.push({ sourceColumn: target, targetColumn: target, confidence: 1 });
                    }
                });
                initialMappings[f.fileId] = fileMaps;
            });
            setMappings(initialMappings);
        }
    }, [files]);

    const generateAIProposals = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/map-schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files })
            });

            if (!res.ok) throw new Error('Failed to generate mappings');

            const data: SchemaMapperResponse = await res.json();

            // Update state with AI proposals
            const uniqueTargetSchema = Array.from(new Set(data.targetSchema));
            setTargetSchema(uniqueTargetSchema);

            setMappings(data.mappings);
            setMergeStrategy(data.mergeStrategy);
            if (data.commonIdentifiers?.[0]) {
                setCommonIdentifier(data.commonIdentifiers[0]);
            }
        } catch (err) {
            console.error(err);
            setError("AI Generation failed. Please try manual mapping.");
        } finally {
            setLoading(false);
        }
    };

    const updateMapping = (fileId: string, targetCol: string, sourceCol: string) => {
        setMappings(prev => {
            const fileMaps = [...(prev[fileId] || [])];
            const existingIndex = fileMaps.findIndex(m => m.targetColumn === targetCol);

            if (sourceCol === '__none__') {
                if (existingIndex >= 0) fileMaps.splice(existingIndex, 1);
            } else {
                const newMap = { sourceColumn: sourceCol, targetColumn: targetCol, confidence: 1 };
                if (existingIndex >= 0) {
                    fileMaps[existingIndex] = newMap;
                } else {
                    fileMaps.push(newMap);
                }
            }
            return { ...prev, [fileId]: fileMaps };
        });
    };

    const addTargetColumn = () => {
        let name = `New Column ${targetSchema.length + 1}`;
        let counter = 1;
        while (targetSchema.includes(name)) {
            name = `New Column ${targetSchema.length + 1 + counter}`;
            counter++;
        }
        setTargetSchema([...targetSchema, name]);
    };

    const removeTargetColumn = (col: string) => {
        setTargetSchema(targetSchema.filter(c => c !== col));
    };

    const renameTargetColumn = (oldName: string, newName: string) => {
        if (!newName || oldName === newName) return;
        if (targetSchema.includes(newName)) {
            // Prevent duplicate names or handle gracefully? 
            // For now, prevent default rename if exists to maintain uniqueness
            return;
        }

        setTargetSchema(targetSchema.map(c => c === oldName ? newName : c));
        // Update mappings to point to new name
        setMappings(prev => {
            const next: Record<string, ColumnMapping[]> = {};
            Object.keys(prev).forEach(fid => {
                next[fid] = prev[fid].map(m => m.targetColumn === oldName ? { ...m, targetColumn: newName } : m);
            });
            return next;
        });
        if (commonIdentifier === oldName) setCommonIdentifier(newName);
    };

    const handleComplete = () => {
        onMappingComplete({
            mappings,
            targetSchema,
            commonIdentifiers: [commonIdentifier],
            mergeStrategy,
            reasoning: "User defined schema"
        });
    };


    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const [allPossibleColumns, setAllPossibleColumns] = useState<string[]>([]);

    // Collect all unique columns on load
    useEffect(() => {
        const cols = new Set<string>();
        files.forEach(f => f.headers.forEach(h => cols.add(h)));
        setAllPossibleColumns(Array.from(cols).sort());
    }, [files]);

    const toggleColumn = (col: string) => {
        if (targetSchema.includes(col)) {
            removeTargetColumn(col);
        } else {
            setTargetSchema([...targetSchema, col]);
            // Auto-map if possible
            const newMappings = { ...mappings };
            files.forEach(f => {
                if (f.headers.includes(col)) {
                    if (!newMappings[f.fileId]) newMappings[f.fileId] = [];
                    newMappings[f.fileId].push({ sourceColumn: col, targetColumn: col, confidence: 1 });
                }
            });
            setMappings(newMappings);
        }
    };



    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm z-10 relative">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Schema Editor</h2>
                        <p className="text-sm text-slate-500">Define your target schema and map sources</p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors border border-slate-200"
                    >
                        <Edit2 className="w-4 h-4" />
                        <span>Select Columns</span>
                    </button>
                    <div className="h-8 w-px bg-slate-200 mx-2" />
                    <button
                        onClick={generateAIProposals}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-medium transition-colors border border-purple-200"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        <span>AI Suggest</span>
                    </button>
                    <div className="h-8 w-px bg-slate-200 mx-2" />
                    <button
                        onClick={handleComplete}
                        className="px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold shadow-md shadow-indigo-200 transition-all transform hover:scale-105"
                    >
                        Confirm & Merge
                    </button>
                </div>

                {/* Column Selector Dropdown/Modal */}
                {isColumnSelectorOpen && (
                    <div className="absolute top-20 right-4 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
                            <h3 className="font-semibold text-sm">Include Columns</h3>
                            <button onClick={() => setIsColumnSelectorOpen(false)} className="text-slate-400 hover:text-slate-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {allPossibleColumns.map(col => (
                                <div key={col} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={targetSchema.includes(col)}
                                        onChange={() => toggleColumn(col)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700 truncate" title={col}>{col}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>


            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 flex items-center space-x-2">
                    <span className="font-bold">Error:</span>
                    <span>{error}</span>
                </div>
            )
            }

            {/* Global Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Merge Strategy</label>
                    <select
                        value={mergeStrategy}
                        onChange={(e) => setMergeStrategy(e.target.value as any)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    >
                        <option value="outer_join">Full Outer Join (Keep all rows)</option>
                        <option value="inner_join">Inner Join (Only matching rows)</option>
                        <option value="left_join">Left Join (Keep first file rows)</option>
                        <option value="append">Append (UNION - Stack all files)</option>
                    </select>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Common Identifier (Join Key)</label>
                    <select
                        value={commonIdentifier}
                        onChange={(e) => setCommonIdentifier(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    >
                        {targetSchema.map(col => (
                            <option key={col} value={col}>{col}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Mappings Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Target Column</th>
                                {files.map(f => (
                                    <th key={f.fileId} className="p-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">
                                        <div className="flex flex-col">
                                            <span className="truncate max-w-[150px]" title={f.name}>{f.name}</span>
                                            <span className="text-[10px] font-normal text-slate-400">{f.headers.length} cols</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-4 py-3 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {targetSchema.map((targetCol, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 group transition-colors">
                                    <td className="p-3">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:outline-none font-medium text-slate-700 px-1 py-0.5 transition-all text-sm"
                                            value={targetCol}
                                            onChange={(e) => renameTargetColumn(targetCol, e.target.value)}
                                        />
                                        <div className="h-0.5 w-0 bg-indigo-500 transition-all group-focus-within:w-full" />
                                    </td>
                                    {files.map(f => {
                                        const currentMap = mappings[f.fileId]?.find(m => m.targetColumn === targetCol);
                                        return (
                                            <td key={f.fileId} className="p-3">
                                                <select
                                                    className={cn(
                                                        "w-full text-xs p-2 rounded border focus:ring-2 focus:ring-indigo-100 outline-none transition-all",
                                                        currentMap ? "border-indigo-200 bg-indigo-50/30 text-indigo-900" : "border-slate-200 text-slate-400 italic"
                                                    )}
                                                    value={currentMap?.sourceColumn || '__none__'}
                                                    onChange={(e) => updateMapping(f.fileId, targetCol, e.target.value)}
                                                >
                                                    <option value="__none__">-- Ignore --</option>
                                                    {f.headers.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        );
                                    })}
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => removeTargetColumn(targetCol)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove Column"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <button
                        onClick={addTargetColumn}
                        className="flex items-center space-x-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add New Column</span>
                    </button>
                </div>
            </div>
        </div >
    );
}
