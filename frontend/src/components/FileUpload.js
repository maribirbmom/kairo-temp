import React, { useState, useCallback } from 'react';

const FileUpload = ({ onFilesSelected, files, onRemoveFile, onDetailedAnalysis }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf' || 
                file.name.endsWith('.docx')
    );
    if (droppedFiles.length > 0) {
      onFilesSelected(droppedFiles);
    }
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
    e.target.value = '';
  }, [onFilesSelected]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col gap-6 flex-grow relative z-10">
      {/* Upload Area */}
      <div
        className={`group relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl bg-white/50 transition-all duration-300 cursor-pointer overflow-hidden ${
          isDragging
            ? 'border-primary bg-white shadow-lg shadow-primary/5'
            : 'border-text-muted/20 hover:bg-white hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="file-upload-area"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/0 group-hover:to-primary/5 transition-all"></div>
        <input
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          data-testid="file-input"
        />
        <div className="flex flex-col items-center justify-center relative z-10">
          <div className="bg-white p-4 rounded-full shadow-lg shadow-black/5 mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
            <span className="material-symbols-outlined text-primary text-4xl">cloud_upload</span>
          </div>
          <p className="mb-1 text-base text-text-main font-bold">Click to upload or drag and drop</p>
          <p className="text-sm text-text-muted">PDF or DOCX (max 4 MB per file)</p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-text-main flex items-center justify-between px-1">
            <span>Uploaded Files</span>
            <span className="text-xs font-medium text-text-muted bg-white px-2 py-0.5 rounded-md border border-black/5 shadow-sm">
              {files.length} selected
            </span>
          </h4>

          {files.map((file, index) => (
            <div
              key={file.id || index}
              className="flex items-center justify-between p-3 pl-4 rounded-2xl bg-white border border-transparent hover:border-primary/20 shadow-sm hover:shadow-md transition-all group/file relative overflow-hidden"
              data-testid={`uploaded-file-${index}`}
            >
              <div className="flex items-center gap-4 overflow-hidden relative z-10">
                <div className="bg-red-50 text-red-500 p-2.5 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <p className="text-sm font-bold text-text-main truncate max-w-[180px]">
                    {file.name || file.filename}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-text-muted font-medium">
                      {formatFileSize(file.size || file.file_size)}
                    </p>
                    <span className="size-1 rounded-full bg-text-muted/40"></span>
                    <p className="text-xs text-success font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      {file.status === 'analyzed' ? 'Analyzed' : 'Ready'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-10 pr-1">
                {file.resume_id && (
                  <button
                    onClick={() => onDetailedAnalysis && onDetailedAnalysis(file)}
                    className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary bg-page-bg/40 hover:bg-white border border-transparent hover:border-primary/10 px-3 py-1.5 rounded-lg transition-all"
                    data-testid={`detailed-analysis-btn-${index}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">query_stats</span>
                    Detailed Analysis
                  </button>
                )}
                <button
                  onClick={() => onRemoveFile(file.id || index)}
                  className="text-text-muted hover:text-red-500 hover:bg-red-50 transition-all p-2 rounded-full opacity-0 group-hover/file:opacity-100"
                  data-testid={`remove-file-btn-${index}`}
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
