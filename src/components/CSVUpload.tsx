
'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';
import { parseCSVFile } from '@/lib/csv-parser'; // We'll use client-side parsing for speed/preview

interface CSVUploadProps {
    onFilesUpload: (files: UploadedFile[]) => void;
    maxFiles?: number;
}

export default function CSVUpload({ onFilesUpload, maxFiles = 3 }: CSVUploadProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (files.length + acceptedFiles.length > maxFiles) {
            setError(`You can only upload up to ${maxFiles} files.`);
            return;
        }

        setLoading(true);
        setError(null);

        const newUploadedFiles: UploadedFile[] = [];

        try {
            for (const file of acceptedFiles) {
                const text = await file.text();
                // Parse directly on client for instant feedback
                const parsed = await parseCSVFile(text, file.name);
                newUploadedFiles.push(parsed);
            }

            const updated = [...files, ...newUploadedFiles];
            setFiles(updated);
            onFilesUpload(updated);
        } catch (err) {
            console.error(err);
            setError("Failed to parse one or more files. Please ensure they are valid CSVs.");
        } finally {
            setLoading(false);
        }
    }, [files, maxFiles, onFilesUpload]);

    const removeFile = (id: string) => {
        const updated = files.filter(f => f.fileId !== id);
        setFiles(updated);
        onFilesUpload(updated);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv']
        },
        disabled: loading || files.length >= maxFiles
    });

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            <div
                {...getRootProps()}
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-10 transition-all duration-300 ease-in-out text-center cursor-pointer overflow-hidden",
                    isDragActive ? "border-blue-500 bg-blue-50/50 scale-[0.99]" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                    (loading || files.length >= maxFiles) && "opacity-50 cursor-not-allowed"
                )}
            >
                <input {...getInputProps()} />
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none" />

                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-white/80 rounded-full shadow-lg backdrop-blur-sm border border-slate-100 p-6">
                        {loading ? (
                            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                        ) : (
                            <Upload className="w-10 h-10 text-blue-600" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-slate-800">
                            {loading ? "Processing..." : "Drop CSV files here"}
                        </h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">
                            Drag & drop or click to upload. Up to {maxFiles} files.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {files.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider pl-1">Uploaded Files</h4>
                    <div className="grid gap-3">
                        {files.map((file) => (
                            <div
                                key={file.fileId}
                                className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                        <FileText className="w-6 h-6 text-slate-500" />
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-slate-900 truncate max-w-[200px]">{file.name}</h5>
                                        <div className="flex items-center space-x-3 text-xs text-slate-500">
                                            <span>{file.totalRows.toLocaleString()} rows</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className={cn(
                                                "flex items-center",
                                                file.quality > 80 ? "text-emerald-600" : file.quality > 50 ? "text-amber-600" : "text-red-600"
                                            )}>
                                                Quality: {file.quality}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => removeFile(file.fileId)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
