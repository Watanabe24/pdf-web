"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState("pdf");
  const [progress, setProgress] = useState(0);

  const onDrop = (acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const upload = async () => {
    if (files.length === 0) {
      alert("ファイル選べ");
      return;
    }

    try {
      setStatus("変換中...");
      setProgress(10);

      const interval = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.random() * 10));
      }, 300);

      const form = new FormData();

      files.forEach((file) => {
        form.append("files", file);
      });

      form.append("format", format);

      const res = await fetch("http://localhost:4000/convert-multi", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        clearInterval(interval);
        setProgress(0);
        setStatus("エラー: " + (text || "不明"));
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "converted.zip";
      a.click();

      clearInterval(interval);
      setProgress(100);
      setStatus("完了");
    } catch (e) {
      setStatus("通信エラー");
      setProgress(0);
    }
  };

  return (
    <main className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow w-80 text-center">
        <h1 className="text-xl mb-4">ファイル変換（複数対応）</h1>

        <div
          {...getRootProps()}
          className="mb-4 p-6 border-2 border-dashed rounded bg-gray-50 cursor-pointer"
        >
          <input {...getInputProps()} />

          {isDragActive ? (
            <p>ここにドロップ</p>
          ) : files.length > 0 ? (
            <p>{files.length} 個のファイル</p>
          ) : (
            <p>ドラッグ&ドロップ or クリック</p>
          )}
        </div>

        <div className="mb-3">
          <div className="w-full bg-gray-200 h-2 rounded">
            <div
              className="bg-black h-2 rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs mt-1">{Math.floor(progress)}%</p>
        </div>

        <select
          onChange={(e) => setFormat(e.target.value)}
          value={format}
          className="mb-4 w-full border p-2"
        >
          <option value="pdf">PDF</option>
          <option value="docx">Word</option>
          <option value="xlsx">Excel</option>
          <option value="pptx">PowerPoint</option>
          <option value="txt">Text</option>
        </select>

        <button
          onClick={upload}
          className="bg-black text-white px-4 py-2 rounded w-full"
        >
          一括変換
        </button>

        <p className="mt-4">{status}</p>
      </div>
    </main>
  );
}