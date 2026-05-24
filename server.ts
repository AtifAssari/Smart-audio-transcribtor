import express from "express";
import { spawn } from "child_process";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

dotenv.config();

// Write startup log and hook global error handers
try {
  fs.writeFileSync(path.join(process.cwd(), "startup.log"), `Startup initiated at ${new Date().toISOString()}\nNODE_ENV: ${process.env.NODE_ENV}\n`);
} catch (e) {}

process.on("uncaughtException", (err) => {
  try {
    fs.appendFileSync(path.join(process.cwd(), "startup.log"), `CRASH (uncaughtException): ${err.stack || err}\n`);
  } catch (e) {}
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  try {
    fs.appendFileSync(path.join(process.cwd(), "startup.log"), `CRASH (unhandledRejection): ${reason instanceof Error ? reason.stack : reason}\n`);
  } catch (e) {}
});

// Fixes for ESModule globals
const __filename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : "";
const __dirname = __filename ? path.dirname(__filename) : "";

// Helper to extract YouTube video ID from any standard YouTube URL format
function extractYoutubeId(urlStr: string): string | null {
  const match = urlStr.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

// Custom scanner to extract playerCaptionsTracklistRenderer JSON from YouTube's desktop page structure
function parsePlayerCaptions(html: string): any {
  // Try 1: Parse from ytInitialPlayerResponse
  try {
    const match = html.match(/(?:window\s*\[\s*["']ytInitialPlayerResponse["']\s*\]|ytInitialPlayerResponse)\s*=\s*({[\s\S]+?});/);
    if (match) {
      const obj = JSON.parse(match[1]);
      if (obj && obj.captions && obj.captions.playerCaptionsTracklistRenderer) {
        return obj.captions.playerCaptionsTracklistRenderer;
      }
    }
  } catch (e) {}

  try {
    const match2 = html.match(/(?:window\s*\[\s*["']ytInitialPlayerResponse["']\s*\]|ytInitialPlayerResponse)\s*=\s*({[\s\S]+?})\s*<\/script>/);
    if (match2) {
      const obj = JSON.parse(match2[1]);
      if (obj && obj.captions && obj.captions.playerCaptionsTracklistRenderer) {
        return obj.captions.playerCaptionsTracklistRenderer;
      }
    }
  } catch (e) {}

  // Try 2: Traditional substring scanning with escaped quote resolution supporting embbed pages
  let index = html.indexOf('"playerCaptionsTracklistRenderer"');
  let isEscapedStr = false;
  if (index === -1) {
    index = html.indexOf('\\"playerCaptionsTracklistRenderer\\"');
    if (index !== -1) {
      isEscapedStr = true;
    }
  }
  
  if (index === -1) return null;
  const startJson = html.indexOf('{', index);
  if (startJson === -1) return null;
  
  let openBraces = 0;
  let inString = false;
  let isEscaped = false;
  let endJson = -1;
  
  for (let i = startJson; i < html.length; i++) {
    const char = html[i];
    const prevChar = i > 0 ? html[i - 1] : "";

    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\') {
      isEscaped = true;
      continue;
    }
    if (char === '"' || (isEscapedStr && char === '"' && prevChar === '\\')) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        openBraces++;
      } else if (char === '}') {
        openBraces--;
        if (openBraces === 0) {
          endJson = i;
          break;
        }
      }
    }
  }
  
  if (endJson === -1) return null;
  try {
    let rawJson = html.substring(startJson, endJson + 1);
    if (isEscapedStr) {
      rawJson = rawJson
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\\/\//g, '/')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
    }
    const parsed = JSON.parse(rawJson);
    return parsed;
  } catch (e) {
    return null;
  }
}

// Fetch YouTube Transcript through direct page crawling + XML extraction with fallbacks
async function fetchYoutubeTranscriptCustom(videoId: string): Promise<string> {
  const urls = [
    `https://www.youtube.com/embed/${videoId}`,
    `https://www.youtube.com/watch?v=${videoId}`
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      console.log(`[معالجة يوتيوب] البدء في الحصول على الترجمة من الرابط: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "ar,en-US,en;q=0.9"
        }
      });

      if (!response.ok) {
        throw new Error(`فشل الاتصال بـ يوتيوب (كود الاستجابة ${response.status})`);
      }

      const html = await response.text();
      const captionsData = parsePlayerCaptions(html);

      if (!captionsData || !captionsData.captionTracks || captionsData.captionTracks.length === 0) {
        throw new Error("لم يعثر السيرفر على ترجمات مدمجة في هذا الرابط الاستكشافي.");
      }

      const tracks = captionsData.captionTracks;
      // Look for Arabic ('ar'), then English ('en'), then any other track
      let selectedTrack = tracks.find((t: any) => t.languageCode === "ar");
      if (!selectedTrack) {
        selectedTrack = tracks.find((t: any) => t.languageCode === "en");
      }
      if (!selectedTrack) {
        selectedTrack = tracks[0];
      }

      if (!selectedTrack || !selectedTrack.baseUrl) {
        throw new Error("ملف الترجمة المحدد فارغ أو غير متاح.");
      }

      let fetchUrl = selectedTrack.baseUrl;
      const hasArabicTranslation = captionsData.translationLanguages && captionsData.translationLanguages.some((tl: any) => tl.languageCode === "ar");
      if (selectedTrack.languageCode !== "ar" && hasArabicTranslation) {
        fetchUrl += "&tlang=ar";
      }

      const captionResponse = await fetch(fetchUrl);
      if (!captionResponse.ok) {
        throw new Error(`فشل تحميل محتوى الترجمة من خوادم يوتيوب (كود ${captionResponse.status})`);
      }

      const xmlText = await captionResponse.text();
      const textTags = xmlText.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
      if (!textTags || textTags.length === 0) {
        throw new Error("ملف تفريغ نصوص يوتيوب المسترجع فارغ.");
      }

      const parts = textTags.map(tag => {
        const match = tag.match(/<text[^>]*>([\s\S]*?)<\/text>/i);
        if (!match) return "";
        let content = match[1];
        // Decode HTML entities
        content = content
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/&#x2F;/g, "/")
          .replace(/[\r\n]+/g, " ");
        return content;
      });

      const resultText = parts.join(" ").trim();
      if (resultText && resultText.length > 0) {
        return resultText;
      }
    } catch (err: any) {
      console.warn(`[YouTube Parser] فشلت المحاولة لطلب ${url}:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("حدث عطل في استرداد الترجمات للمقطع التابع ليوتيوب.");
}

// Heuristic to detect Arabic vs English language in text
function detectLanguageOfText(text: string): "ar" | "en" {
  let arCount = 0;
  let enCount = 0;
  for (let i = 0; i < Math.min(text.length, 1000); i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0600 && code <= 0x06FF) {
      arCount++;
    } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      enCount++;
    }
  }
  return arCount >= enCount ? "ar" : "en";
}

// Helper to run Whisper locally via python child process
function runLocalWhisper(filePath: string, modelSize: string = "small"): Promise<{ transcription: string, language: string }> {
  return new Promise((resolve, reject) => {
    console.log(`[Whisper المحلي] بدء تفريغ الملف عبر Python: ${filePath} باستخدام النموذج ${modelSize}`);
    const py = spawn("python", ["transcribe.py", filePath, modelSize]);
    let stdoutData = "";
    let stderrData = "";

    py.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    py.stderr.on("data", (data) => {
      stderrData += data.toString();
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          console.log(`[Whisper Python Progress] ${line.trim()}`);
        }
      }
    });

    py.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`فشل تشغيل ويسبر المحلي بكود الخروج ${code}. الخطأ: ${stderrData}`));
        return;
      }
      try {
        const result = JSON.parse(stdoutData.trim());
        if (result.success) {
          resolve({
            transcription: result.transcription,
            language: result.language
          });
        } else {
          reject(new Error(result.error || "خطأ مجهول في ويسبر المحلي"));
        }
      } catch (e: any) {
        reject(new Error(`فشل قراءة مخرجات ويسبر المحلي: ${stdoutData}. الخطأ: ${e.message}`));
      }
    });
  });
}

const arabicFormatterPrompt = `أنت خبير متمرس في تحرير وتنسيق النصوص وتفريغ المحاضرات والدروس التعليمية باللغة العربية.
مهمتك هي إعادة تنسيق وهيكلة النص العربي المفرغ المرفق ليكون سهل القراءة ومنظماً بشكل ممتع وجميل للعين.

اتبع التعليمات التالية بدقة:
1. استخدم لغة عربية فصحى مبسطة ومهذبة مع الحفاظ على الكلمات والجمل الأصلية للمتحدث (لا تغير المعنى أو تحذف أفكاراً، فقط قم بتنظيم النص).
2. قسم النص إلى فقرات منطقية ومترابطة لتسهيل القراءة البصرية.
3. استخدم العناوين الرئيسية والفرعية بوضوح باستخدام ماركداون (Markdown) مثل:
   - ## عنوان رئيسي للموضوع الأساسي
   - ### عنوان فرعي للتفاصيل والنقاط الفرعية
4. استخدم القوائم النقطية (Bullet points) ورؤوس النقاط (مثال: * أو -) لتلخيص الأفكار الهامة، الخطوات العمليّة، أو التعدادات التي ذكرها المتحدث.
5. ضع الكلمات المفتاحية والمصطلحات الهامة بالخط العريض (**مصطلح**) لإبرازها.
6. إذا كان هناك متحدثون متعددون، ميز بينهم بوضوح (مثال: **المتحدث الأول:**، **المتحدث الثاني:**).
7. لا تقم بتأليف أو اختلاق أي معلومات خارجية تزيد عن النص المرفق بتاتاً لضمان الصدق التام والأمانة المطلقة.`;

const englishFormatterPrompt = `You are an expert editor specialized in formatting and structuring educational transcriptions, lectures, and lessons in English.
Your task is to take the provided raw English transcription and re-format, structure, and edit it to be highly readable, clear, and visually appealing.

Strictly adhere to the following guidelines:
1. Maintain the speaker's original words, tone, and vocabulary. Do not alter the meaning or skip any thoughts; focus on formatting and readability.
2. Structure the text into clear, logical paragraphs with smooth transitions.
3. Organize the content using clear Markdown headings and subheadings:
   - Use '## Heading' for main topics/sections.
   - Use '### Subheading' for subtopics and specific details.
4. Highlight key takeaways, action items, or lists using Markdown bullet points (e.g., using * or -).
5. Emphasize important terms, concepts, or keywords using bold text (**keyword**).
6. If there are multiple speakers, clearly differentiate them (e.g., **Speaker 1:**, **Speaker 2:**).
7. Do not invent or add any external information not present in the original transcript to ensure absolute accuracy and integrity.`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Multer configurations: Store uploaded files directly on disk to prevent RAM OOM crashes
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_") || "audio.wav";
      cb(null, `upload_${uniqueSuffix}_${safeName}`);
    }
  });

  const upload = multer({
    storage: storage,
    limits: { fileSize: 2000 * 1024 * 1024 } // 350MB Max to support compressed audio/video chunks
  });

  app.use(express.json({ limit: "2000mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2000mb" }));

  // API Endpoints:
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Summarization Endpoint based on Gemini 3.5 Flash
  app.post("/api/summarize", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: "يرجى تقديم النص المراد تلخيصه." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "مفتاح API الخاص بـ Gemini غير مهيأ. يرجى إضافته كـ (GEMINI_API_KEY) في لوحة الإعدادات والمفاتيح."
        });
      }

      console.log(`[التلخيص الذكي] جاري تلخيص نص بطول ${text.length} حرف...`);
      
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const prompt = `أنت خبير تلخيص نصوص محترف وأمين. قم بقراءة النص المفرغ التالي وصياغة ملخص سريع مكثف وغني بالأفكار الرئيسية يوضح جوهر ومضمون المحتوى بدقة وعامية أو فصحى مهذبة ومباشرة في حدود 2-4 جمل بليغة ومباشرة باللغة العربية الفصحى. لا تضف أي مقدمات أو كلام ترحيبي، اكتب الملخص مباشرة:
      
      النص المفرغ:
      """
      ${text}
      """`;

      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            text: prompt
          }
        ]
      });

      const summaryText = result.text || "لم يتمكن النموذج من استخراج ملخص.";
      return res.json({
        success: true,
        summary: summaryText.trim()
      });

    } catch (error: any) {
      console.error("Summarize Handler Server Error:", error);
      return res.status(500).json({
        success: false,
        error: `حدث خلل أثناء توليد الملخص: ${error.message || error}`
      });
    }
  });

  // Transcription Endpoint
  app.post("/api/transcribe", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("[Multer Error]:", err);
        return res.status(400).json({
          success: false,
          error: `⚠️ فشل استقبال أو تحميل الملف التابع لك: ${err.message || err}. يرجى محاولة استخدام ملف أصغر (بحد أقصى 350 ميجابايت) أو التحقق من اتصال الإنترنت.`
        });
      }
      next();
    });
  }, async (req, res) => {
    let filePathToUpload = "";
    let needsCleanup = false;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "مفتاح API الخاص بـ Gemini غير مهيأ. يرجى إضافته كـ (GEMINI_API_KEY) في لوحة الإعدادات والمفاتيح."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      let mimeType = "";
      let sourceName = "";
      let isYoutube = false;
      let isPaste = false;
      let youtubeTranscriptText = "";
      let pastedText = "";
      const localModelSize = req.body.localModelSize || "small";

      if (req.file) {
        mimeType = req.file.mimetype;
        filePathToUpload = req.file.path;
        sourceName = req.file.originalname;
        needsCleanup = true;
      } else if (req.body.text) {
        isPaste = true;
        pastedText = req.body.text.trim();
        sourceName = req.body.title || "نص ملصق يدوي (متصفح)";
      } else if (req.body.url) {
        const urlStr = req.body.url.trim();
        const youtubeId = extractYoutubeId(urlStr);

        if (youtubeId) {
          isYoutube = true;
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
            const oembedRes = await fetch(oembedUrl);
            if (oembedRes.ok) {
              const oembedData: any = await oembedRes.json();
              sourceName = oembedData.title || `يوتيوب (${youtubeId})`;
            } else {
              sourceName = `فيديو يوتيوب (${youtubeId})`;
            }
          } catch (oembedErr) {
            sourceName = `فيديو يوتيوب (${youtubeId})`;
          }

          try {
            console.log(`[معالجة يوتيوب] البدء في فك رموز والبحث عن الترجمة للمقطع: ${youtubeId}`);
            youtubeTranscriptText = await fetchYoutubeTranscriptCustom(youtubeId);
            console.log(`[معالجة يوتيوب] نجح الاستخراج المباشر لنص الترجمة الممتد (${youtubeTranscriptText.length} حرف).`);
          } catch (customErr: any) {
            console.log(`[معالجة يوتيوب] الترجمة المدمجة المباشرة غير متوفرة، جاري تجربة المحاولة البديلة عبر المكتبة القياسية...`);
            try {
              const youtubeTranscriptPkg = await import("youtube-transcript");
              const Lib = (youtubeTranscriptPkg as any).YoutubeTranscript || (youtubeTranscriptPkg as any).default?.YoutubeTranscript || (youtubeTranscriptPkg as any).default || youtubeTranscriptPkg;
              
              const transcriptArray = await Lib.fetchTranscript(youtubeId);
              if (!transcriptArray || transcriptArray.length === 0) {
                throw new Error("قامت المكتبة بإرجاع قائمة ترجمة فارغة.");
              }
              youtubeTranscriptText = transcriptArray.map((t: any) => t.text).join(" ");
              console.log(`[معالجة يوتيوب] نجح الاستخراج عبر المكتبة (${youtubeTranscriptText.length} حرف).`);
            } catch (libErr: any) {
              throw new Error(`لم نتمكن من جلب الترجمة بالطرق المتاحة: ${libErr.message || libErr}`);
            }
          }
        } else {
          // Standard Direct Web Link Download
          sourceName = urlStr.split("/").pop() || "رابط خارجي";

          try {
            const fetchRes = await fetch(urlStr);
            if (!fetchRes.ok) {
              throw new Error(`فشل تحميل الملف من الرابط المباشر. كود الاستجابة: ${fetchRes.status}`);
            }

            mimeType = fetchRes.headers.get("content-type") || "audio/mp3";
            const ext = urlStr.split(".").pop()?.split("?")[0]?.toLowerCase() || "mp3";
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            filePathToUpload = path.join(os.tmpdir(), `download_${uniqueSuffix}.${ext}`);
            
            const arrayBuffer = await fetchRes.arrayBuffer();
            fs.writeFileSync(filePathToUpload, Buffer.from(arrayBuffer));
            needsCleanup = true;
          } catch (fetchErr: any) {
            return res.status(400).json({
              success: false,
              error: `فشل تحميل الملف الصوتي من الرابط الخارجي المباشر: ${fetchErr.message || fetchErr}`
            });
          }
        }
      }

      // Step 1: Obtain the raw text and detect language
      let rawText = "";
      let detectedLang: "ar" | "en" = "ar";

      if (isPaste) {
        rawText = pastedText;
        detectedLang = detectLanguageOfText(rawText);
        console.log(`Processing Pasted Text: ${sourceName} (${pastedText.length} chars of text, detected language: ${detectedLang})`);
      } else if (isYoutube) {
        rawText = youtubeTranscriptText;
        detectedLang = detectLanguageOfText(rawText);
        console.log(`Processing YouTube Video: ${sourceName} (${youtubeTranscriptText.length} chars of transcript, detected language: ${detectedLang})`);
      } else {
        // Local Whisper path for file uploads or external direct downloads
        if (!filePathToUpload || !fs.existsSync(filePathToUpload)) {
          return res.status(400).json({
            success: false,
            error: "لم يتم تزويد ملف وسائط صالح أو نص تفريغ للتفريغ."
          });
        }
        console.log(`Processing media locally via Whisper: Name: ${sourceName}, Model: ${localModelSize}`);
        const whisperResult = await runLocalWhisper(filePathToUpload, localModelSize);
        rawText = whisperResult.transcription;
        detectedLang = whisperResult.language === "en" ? "en" : "ar"; // map detected language safely
        console.log(`Local Whisper transcription completed. Length: ${rawText.length} chars, language: ${detectedLang}`);
      }

      if (!rawText || !rawText.trim()) {
        return res.status(400).json({
          success: false,
          error: "فشلت عملية تفريغ الملف الصوتي أو النص ولم يتم استرجاع أي محتوى نصي صالح."
        });
      }

      // Step 2: Choose formatting prompt based on language
      const isArabic = detectedLang === "ar";
      const formatterPrompt = isArabic ? arabicFormatterPrompt : englishFormatterPrompt;

      // Pass the formatting instruction directly inside contents as a combined text block to avoid config bug
      const contents = [
        {
          text: `${formatterPrompt}\n\nالنص الخام المراد تنسيقه وهيكلته بالكامل:\n"""\n${rawText}\n"""`
        }
      ];

      let resultStream;
      try {
        resultStream = await ai.models.generateContentStream({
          model: "gemini-3.5-flash",
          contents: contents
        });
      } catch (geminiInitErr: any) {
        console.error("Failed to initialize generateContentStream:", geminiInitErr);
        return res.status(500).json({
          success: false,
          error: `⚠️ فشل الاتصال المبدئي بمودل الذكاء الاصطناعي: ${geminiInitErr.message || geminiInitErr}`
        });
      }

      // Set headers for NDJSON streaming to prevent timeouts & connection resets
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      let fullText = "";
      try {
        for await (const chunk of resultStream) {
          const textChunk = chunk.text || "";
          fullText += textChunk;
          res.write(JSON.stringify({ text: textChunk }) + "\n");
        }

        // Send final success record
        res.write(JSON.stringify({
          success: true,
          done: true,
          transcription: fullText,
          summary: "",
          sourceName: sourceName,
          language: isArabic ? "العربية" : "English"
        }) + "\n");
        res.end();
      } catch (streamErr: any) {
        console.error("Error reading from Gemini stream:", streamErr);
        res.write(JSON.stringify({
          success: false,
          error: `⚠️ انقطع الاتصال بـ Gemini أثناء معالجة نصوص البث: ${streamErr.message || streamErr}`
        }) + "\n");
        res.end();
      }

    } catch (error: any) {
      console.error("Transcription Handler Server Error:", error);
      return res.status(500).json({
        success: false,
        error: `حدث خلل أثناء تشغيل تفريغ الذكاء الاصطناعي: ${error.message || error}`
      });
    } finally {
      if (needsCleanup && filePathToUpload && fs.existsSync(filePathToUpload)) {
        try {
          console.log(`[تنظيف] جاري حذف الملف المؤقت محلياً: ${filePathToUpload}`);
          fs.unlinkSync(filePathToUpload);
        } catch (unlinkErr) {
          console.error("Failed to delete temp file:", unlinkErr);
        }
      }
    }
  });


  // Global API & Server Error Handler (Catches bodyparser, multer, and other route failures and returns them as clean JSON)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Express Server Error:", err);
    res.status(err.status || err.statusCode || 500).json({
      success: false,
      error: err.message || "حدث خطأ داخلي غير معروف في خادم التفريغ."
    });
  });

  // Serve static files in production / use Vite in development
  const distPath = path.join(process.cwd(), "dist");
  const isCjsBundle = typeof __filename !== "undefined" && __filename && __filename.endsWith("server.cjs");
  const isProd = process.env.NODE_ENV === "production" || !!isCjsBundle;

  try {
    fs.appendFileSync(path.join(process.cwd(), "startup.log"), `Setting up router. isProd: ${isProd}, distPath exists: ${fs.existsSync(distPath)}\n`);
  } catch (e) {}

  if (!isProd) {
    try {
      fs.appendFileSync(path.join(process.cwd(), "startup.log"), `Importing and creating Vite server...\n`);
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
      fs.appendFileSync(path.join(process.cwd(), "startup.log"), `Vite middleware mounted successfully.\n`);
    } catch (err: any) {
      fs.appendFileSync(path.join(process.cwd(), "startup.log"), `Vite creation FAILED: ${err.stack || err}\n`);
    }
  } else {
    try {
      fs.appendFileSync(path.join(process.cwd(), "startup.log"), `Serving static files from ${distPath}\n`);
    } catch (e) {}
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    try {
      fs.appendFileSync(path.join(process.cwd(), "startup.log"), `App started listening on port ${PORT}\n`);
    } catch (e) {}
    console.log(`Server executing successfully on http://0.0.0.0:${PORT}`);
  });
}

try {
  fs.appendFileSync(path.join(process.cwd(), "startup.log"), `Calling startServer()...\n`);
} catch (e) {}
startServer().catch((err) => {
  try {
    fs.appendFileSync(path.join(process.cwd(), "startup.log"), `startServer() execution FAILED: ${err.stack || err}\n`);
  } catch (e) {}
});
