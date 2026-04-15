"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState("pdf");
  const [progress, setProgress] = useState(0);

  // =========================
  // ファイル制限
  // =========================
  const validateFile = (file: File) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      return "対応していないファイル形式";
    }

    if (file.size > 10 * 1024 * 1024) {
      return "ファイルサイズは10MB以下にしてください";
    }

    return null;
  };

  const onDrop = (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;

    const error = validateFile(f);

    if (error) {
      setStatus("❌ " + error);
      setFile(null);
      return;
    }

    setFile(f);
    setStatus("");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  // =========================
  // エラー翻訳
  // =========================
  const translateError = (text: string) => {
    if (text.includes("unsupported")) return "❌ 非対応のファイル形式";
    if (text.includes("too large")) return "❌ ファイルサイズが大きすぎる";
    if (text.includes("cloudconvert")) return "❌ 変換に失敗しました";
    return "❌ エラーが発生しました";
  };

  const upload = async () => {
    if (!file) {
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
      form.append("file", file);
      form.append("format", format);

      const res = await fetch("/api/convert", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        clearInterval(interval);
        setProgress(0);
        setStatus(translateError(text));
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      // ★ ファイル名維持（ここが修正ポイント）
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      a.download = `${originalName}.${format}`;

      a.click();

      clearInterval(interval);
      setProgress(100);
      setStatus("✅ 変換完了");
    } catch (e: any) {
      setStatus("❌ 通信エラー");
      setProgress(0);
    }
  };

  return (
    <main className="flex items-center justify-center h-screen bg-white text-black">
      <div className="bg-white p-6 rounded-xl shadow w-80 text-center">
        <h1 className="text-xl mb-4">
          PDF一括変換ツール（無料）
        </h1>

        {/* ルール表示 */}
        <p className="text-sm text-gray-700 mb-2">
          対応: JPG / PNG / WEBP / PDF（最大10MB）
        </p>

        <div
          {...getRootProps()}
          className="mb-4 p-6 border-2 border-dashed rounded bg-gray-50 cursor-pointer"
        >
          <input {...getInputProps()} />

          {isDragActive ? (
            <p>ここにドロップ</p>
          ) : file ? (
            <p>{file.name}</p>
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
          変換
        </button>

        <p className="mt-4 text-sm">{status}</p>
      </div>
    </main>
  );
}