import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    let format = formData.get("format") as string;

    // =========================
    // ① ファイル存在チェック
    // =========================
    if (!file) {
      return new Response("file missing", { status: 400 });
    }

    // =========================
    // ② ファイル形式制限
    // =========================
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    const isAllowed =
      allowedTypes.includes(file.type) ||
      file.name.endsWith(".jpg") ||
      file.name.endsWith(".jpeg") ||
      file.name.endsWith(".png") ||
      file.name.endsWith(".webp") ||
      file.name.endsWith(".pdf");

    if (!isAllowed) {
      return new Response("unsupported file type", { status: 400 });
    }

    // =========================
    // ③ ファイルサイズ制限（10MB）
    // =========================
    if (file.size > 10 * 1024 * 1024) {
      return new Response("file too large (max 10MB)", { status: 400 });
    }

    // =========================
    // ④ フォーマット補正（事故防止）
    // =========================
    if (file.type.includes("image")) {
      format = "pdf";
    }

    const apiKey = process.env.CLOUDCONVERT_API_KEY;

    if (!apiKey) {
      return new Response("API key missing", { status: 500 });
    }

    // =========================
    // ⑤ job作成
    // =========================
    const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          import_file: {
            operation: "import/upload",
          },
          convert_file: {
            operation: "convert",
            input: "import_file",
            output_format: format,
          },
          export_file: {
            operation: "export/url",
            input: "convert_file",
          },
        },
      }),
    });

    const jobData = await jobRes.json();

    if (!jobData?.data?.id) {
      console.log("JOB CREATE ERROR:", jobData);
      return new Response(JSON.stringify(jobData), { status: 500 });
    }

    const jobId = jobData.data.id;

    // =========================
    // ⑥ upload task取得
    // =========================
    const uploadTask = jobData.data.tasks?.find(
      (t: any) => t.operation === "import/upload"
    );

    const formObj = uploadTask?.result?.form;

    if (!formObj) {
      return new Response("upload task missing", { status: 500 });
    }

    // =========================
    // ⑦ upload
    // =========================
    const form = new FormData();

    Object.entries(formObj.parameters || {}).forEach(([k, v]) => {
      form.append(k, v as string);
    });

    form.append("file", file);

    const uploadRes = await fetch(formObj.url, {
      method: "POST",
      body: form,
    });

    if (!uploadRes.ok) {
      return new Response("upload failed", { status: 500 });
    }

    // =========================
    // ⑧ polling
    // =========================
    let job;

    for (let i = 0; i < 60; i++) {
      const res = await fetch(
        `https://api.cloudconvert.com/v2/jobs/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      job = await res.json();

      if (job.data.status === "finished") {
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }

      if (job.data.status === "error") {
        return new Response("cloudconvert error", { status: 500 });
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    // =========================
    // ⑨ export取得
    // =========================
    const exportTask = job.data.tasks?.find(
      (t: any) => t.operation === "export/url"
    );

    const fileUrl = exportTask?.result?.files?.[0]?.url;

    if (!fileUrl) {
      return new Response("export failed", { status: 500 });
    }

    // =========================
    // ⑩ download
    // =========================
    const fileRes = await fetch(fileUrl);

    if (!fileRes.ok) {
      return new Response("download failed", { status: 500 });
    }

    const buffer = await fileRes.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="converted.${format}"`,
      },
    });
  } catch (e: any) {
    return new Response("error: " + e.message, { status: 500 });
  }
}