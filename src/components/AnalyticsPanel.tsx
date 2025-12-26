
'use client';

import React from 'react';
import { AnalysisResult } from '@/types';
import { Lightbulb, AlertTriangle, TrendingUp, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsPanelProps {
    analysisResult: AnalysisResult;
}

export default function AnalyticsPanel({ analysisResult }: AnalyticsPanelProps) {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 animate-in slide-in-from-bottom-8 duration-700">

            {/* Insights */}
            <div className="col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center space-x-2 mb-4">
                    <Lightbulb className="w-6 h-6 text-yellow-300" />
                    <h3 className="text-xl font-bold">AI Insights</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    {analysisResult.insights.map((insight, i) => (
                        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <h4 className="font-semibold text-lg mb-1">{insight.title}</h4>
                            <p className="text-indigo-100 text-sm">{insight.description}</p>
                        </div>
                    ))}
                    {analysisResult.insights.length === 0 && (
                        <p className="text-indigo-100 italic">No specific insights detected.</p>
                    )}
                </div>
            </div>

            {/* Anomalies */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
                <div className="flex items-center space-x-2 mb-4 text-amber-600">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="text-lg font-bold">Anomalies Detected</h3>
                </div>
                <div className="space-y-3">
                    {analysisResult.anomalies.slice(0, 5).map((anomaly, i) => (
                        <div key={i} className="flex items-start space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <div className={cn("w-2 h-2 mt-2 rounded-full", anomaly.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500')} />
                            <div>
                                <p className="text-sm font-medium text-slate-800">Row {anomaly.rowId}: {anomaly.column}</p>
                                <p className="text-xs text-slate-600">{anomaly.reason}</p>
                            </div>
                        </div>
                    ))}
                    {analysisResult.anomalies.length === 0 && <p className="text-sm text-slate-500">No anomalies found.</p>}
                </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
                <div className="flex items-center space-x-2 mb-4 text-emerald-600">
                    <TrendingUp className="w-5 h-5" />
                    <h3 className="text-lg font-bold">Recommendations</h3>
                </div>
                <div className="space-y-3">
                    {analysisResult.recommendations.map((rec, i) => (
                        <div key={i} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <p className="text-sm font-medium text-slate-800 mb-1">{rec.action.toUpperCase()}</p>
                            <p className="text-xs text-slate-600">{rec.description}</p>
                        </div>
                    ))}
                    {analysisResult.recommendations.length === 0 && <p className="text-sm text-slate-500">No recommendations.</p>}
                </div>
            </div>
        </div>
    );
}
