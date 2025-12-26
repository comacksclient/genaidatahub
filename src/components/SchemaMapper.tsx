
'use client';

import React, { useState } from 'react';
import { UploadedFile, SchemaMapperResponse, ColumnMapping, MergedData } from '@/types';
import { Loader2, ArrowRight, Wand2, RefreshCw, Check, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchemaMapperProps {
    files: UploadedFile[];
    onMappingComplete: (response: SchemaMapperResponse) => void;
}

export default function SchemaMapper({ files, onMappingComplete }: SchemaMapperProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mappingResult, setMappingResult] = useState<SchemaMapperResponse | null>(null);

    const generateMappings = async () => {
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
            setMappingResult(data);
            onMappingComplete(data);
        } catch (err) {
            console.error(err);
            setError("AI Generation failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!mappingResult && !loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
                    <Wand2 className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2 max-w-md">
                    <h2 className="text-2xl font-bold text-slate-900">AI Schema Analysis</h2>
                    <p className="text-slate-500">
                        Our AI will analyze your {files.length} files to find common identifiers and map equivalent columns automatically.
                    </p>
                </div>
                <button
                    onClick={generateMappings}
                    className="group px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center space-x-2"
                >
                    <span>Generate Mappings</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Wand2 className="w-6 h-6 text-indigo-500" />
                    </div>
                </div>
                <p className="text-slate-500 font-medium animate-pulse">Analyzing schemas with Gemini AI...</p>
            </div>
        );
    }

    // Display Result
    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                            <Layers className="w-5 h-5 text-indigo-500" />
                            <span>Mapping Strategy: {mappingResult?.mergeStrategy.replace('_', ' ').toUpperCase()}</span>
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{mappingResult?.reasoning}</p>
                    </div>
                    <button onClick={generateMappings} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center space-x-1">
                        <RefreshCw className="w-4 h-4" />
                        <span>Regenerate</span>
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Target Schema & Mappings */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Column Mappings</h4>
                        <div className="grid gap-6">
                            {mappingResult?.targetSchema.map(targetCol => (
                                <div key={targetCol} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <span className="font-bold text-slate-800">{targetCol}</span>
                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">Target</span>
                                    </div>
                                    <div className="space-y-2">
                                        {Object.entries(mappingResult.mappings || {}).map(([fileId, maps]) => {
                                            const file = files.find(f => f.fileId === fileId);
                                            const map = maps.find(m => m.targetColumn === targetCol);

                                            if (!map) return null;

                                            return (
                                                <div key={fileId} className="flex items-center justify-between pl-4 pr-2 py-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{file?.name}</span>
                                                        <ArrowRight className="w-3 h-3 text-slate-300" />
                                                        <span className="text-sm font-medium text-slate-700">{map.sourceColumn}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full", map.confidence > 0.8 ? "bg-emerald-500" : "bg-amber-500")}
                                                                style={{ width: `${map.confidence * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-slate-400 font-mono">{(map.confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
