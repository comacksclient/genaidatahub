
'use client';

import React, { useState } from 'react';
import { UploadedFile, SchemaMapperResponse, MergedData, AnalysisResult } from '@/types';
import CSVUpload from '@/components/CSVUpload';
import SchemaMapper from '@/components/SchemaMapper';
import DataWorkbench from '@/components/DataWorkbench';
import AnalyticsPanel from '@/components/AnalyticsPanel';
import { RefreshCw, ArrowRight, Loader2, Database, BrainCircuit, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mergeDatasets } from '@/lib/data-merger';

export default function Home() {
  const [step, setStep] = useState<number>(0);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [mappingResponse, setMappingResponse] = useState<SchemaMapperResponse | null>(null);
  const [mergedData, setMergedData] = useState<MergedData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFilesUploaded = (uploaded: UploadedFile[]) => {
    setFiles(uploaded);
  };

  const proceedToMapping = () => {
    if (files.length < 2) return;
    setStep(1);
  };

  const handleMappingComplete = (response: SchemaMapperResponse) => {
    setMappingResponse(response);
    // Auto-merge to ensure syncing with latest configuration
    performMerge(response);
  };

  const performMerge = async (mappingData: SchemaMapperResponse | null) => {
    const mapData = mappingData || mappingResponse;
    if (!mapData || files.length === 0) return;
    setIsMerging(true);

    try {
      const result = mergeDatasets(
        files.map(f => ({ fileId: f.fileId, rows: f.rows || f.sampleRows })),
        mapData.mappings,
        mapData.commonIdentifiers[0] || 'id',
        mapData.mergeStrategy,
        mapData.targetSchema
      );

      setMergedData(result);
      setStep(2);
    } catch (e) {
      console.error("Merge failed", e);
      alert("Merge failed. See console.");
    } finally {
      setIsMerging(false);
    }
  };

  const performAnalysis = async () => {
    if (!mergedData) return;
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: mergedData.rows.slice(0, 100), // Limit payload
          columns: mergedData.columns
        })
      });

      if (!res.ok) throw new Error("Analysis failed");

      const result = await res.json();
      setAnalysisResult(result);
      setStep(3);
    } catch (e) {
      console.error(e);
      alert("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">

      {/* ... Header ... */}

      <div className="max-w-7xl mx-auto px-6 py-12">
        {step === 0 && (
          // ... (CSVUpload)
          <div className="flex flex-col items-center space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4 max-w-2xl">
              <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Unified Intelligence from Any Data Source</h2>
              <p className="text-lg text-slate-600">
                Upload disparate CSV files and let our GenAI Engine automatically map schemas, resolve conflicts, and merge your data into a single source of truth.
              </p>
            </div>

            <CSVUpload onFilesUpload={handleFilesUploaded} />

            <div className="h-16 flex items-center justify-center">
              {files.length >= 2 && (
                <button
                  onClick={proceedToMapping}
                  className="group relative px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-semibold shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center space-x-2"
                >
                  <span>Analyze Schemas</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">Schema Mapping</h2>
              <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-indigo-600">Back to Upload</button>
            </div>

            <SchemaMapper files={files} onMappingComplete={handleMappingComplete} />

            {/* Removed manual merge button to enforce "Confirm & Merge" flow */}
          </div>
        )}

        {step === 2 && mergedData && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">Data Workbench</h2>
              <div className="flex space-x-4">
                <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-indigo-600">Back to Mapping</button>
              </div>
            </div>

            <DataWorkbench mergedData={mergedData} />

            <div className="flex justify-center pt-8">
              <button
                onClick={performAnalysis}
                disabled={isAnalyzing}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg flex items-center space-x-3 transition-transform hover:scale-105"
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                <span>{isAnalyzing ? "Analyzing Patterns..." : "Run AI Analysis"}</span>
              </button>
            </div>
          </div>
        )}

        {step === 3 && analysisResult && mergedData && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">Intelligence Report</h2>
              <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-indigo-600">Back to Data</button>
            </div>

            <AnalyticsPanel analysisResult={analysisResult} />

            <div className="pt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Source Data</h3>
              <DataWorkbench mergedData={mergedData} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
