import express from "express";
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
        .replace(/\\\//g, '/')
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
    limits: { fileSize: 350 * 1024 * 1024 } // 350MB Max to support compressed audio/video chunks
  });

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

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
          error: `⚠️ فشل استقبال أو تحميل الملف التابع لك: ${err.message || err}. يرجى محاولة استخدام ملف أصغر (بحد أقصى 350 ميغابايت) أو التحقق من اتصال الإنترنت.`
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "مفتاح API الخاص بـ Gemini غير مهيأ. يرجى إضافته كـ (GEMINI_API_KEY) في لوحة الإعدادات والمفاتيح."
        });
      }

      // Lazy Initialization
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      let mimeType = "";
      let filePathToUpload = "";
      let sourceName = "";
      let isYoutube = false;
      let isPaste = false;
      let youtubeTranscriptText = "";
      let pastedText = "";
      let needsCleanup = false;

      if (req.file) {
        mimeType = req.file.mimetype;
        filePathToUpload = req.file.path;
        sourceName = req.file.originalname;
        needsCleanup = true; // Delete the disk file after we are done
      } else if (req.body.text) {
        isPaste = true;
        pastedText = req.body.text.trim();
        sourceName = req.body.title || "نص ملصق يدوي (متصفح)";
      } else if (req.body.url) {
        const urlStr = req.body.url.trim();
        const youtubeId = extractYoutubeId(urlStr);

        if (youtubeId) {
          isYoutube = true;
          // Step 1: Smartly fetch YouTube Video details via oEmbed (gives official video Title without API keys)
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

          // Step 2: Grab transcripts natively using the custom scraper with a library fallback & AI Synthesis
          try {
            console.log(`[معالجة يوتيوب] البدء في فك رموز والبحث عن الترجمة للمقطع: ${youtubeId}`);
            youtubeTranscriptText = await fetchYoutubeTranscriptCustom(youtubeId);
            console.log(`[معالجة يوتيوب] نجح الاستخراج المباشر لنص الترجمة الممتد (${youtubeTranscriptText.length} حرف).`);
          } catch (customErr: any) {
            console.log(`[معالجة يوتيوب] الترجمة المدمجة المباشرة غير متوفرة، جاري تجربة المحاولة البديلة عبر المكتبة القياسية...`);
            try {
              const youtubeTranscriptPkg = await import("youtube-transcript");
              // Determine which CJS/ESM shape was loaded and resolve the class safely
              const Lib = (youtubeTranscriptPkg as any).YoutubeTranscript || (youtubeTranscriptPkg as any).default?.YoutubeTranscript || (youtubeTranscriptPkg as any).default || youtubeTranscriptPkg;
              
              const transcriptArray = await Lib.fetchTranscript(youtubeId);
              if (!transcriptArray || transcriptArray.length === 0) {
                throw new Error("قامت المكتبة بإرجاع قائمة ترجمة فارغة.");
              }
              youtubeTranscriptText = transcriptArray.map((item: any) => item.text).join(" ");
              console.log(`[معالجة يوتيوب] نجح الحصول على النصوص البديلة عبر المكتبة القياسية (${youtubeTranscriptText.length} حرف).`);
            } catch (transcriptError: any) {
              const detailMessage = customErr.message || transcriptError.message || "";
              return res.status(400).json({
                success: false,
                error: `⚠️ نأسف جداً، هذا المقطع على يوتيوب لا يحتوي على ملف ترجمة تفريغية (Subtitles/Captions) مدمجة أو نصوص تلقائية متوفرة لسحبها.\n\n` +
                       `التزاماً بالأمانة التامة ورغبتكم الصارمة في تفادي أي تأليف أو تزييف لما يقوله المتحدث، فإننا نرفض صياغة أي نصوص افتراضية.\n\n` +
                       `📌 للحل البديل والأدق بنسبة 100%:\n` +
                       `يرجى تحميل المقطع الصوتي أو الفيديو ورفعه مباشرة كملف بصيغة mp3 أو wav أو mp4، ليقوم الذكاء الاصطناعي بالاستماع للأوديو مباشرة وتفريغه حرفياً ومباشرة بلهجة المتحدث دون أي تعديل أو ابتكار.`
              });
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

      let fileUpload: any = null;

      if (!isYoutube && !isPaste) {
        // Check if mimeType is correct, or defaulting it if binary
        if (!mimeType || mimeType === "application/octet-stream") {
          // Infer standard type by name block
          const ext = sourceName.split(".").pop()?.toLowerCase();
          if (["mp3", "mpeg", "mpeg3"].includes(ext || "")) mimeType = "audio/mp3";
          else if (["mp4", "m4v"].includes(ext || "")) mimeType = "video/mp4";
          else if (["wav", "wave"].includes(ext || "")) mimeType = "audio/wav";
          else if (["ogg", "webm"].includes(ext || "")) mimeType = "audio/ogg";
          else mimeType = "audio/mp3"; // default fallback for speech
        }
        
        let fileSizeInBytes = 0;
        try {
          const stats = fs.statSync(filePathToUpload);
          fileSizeInBytes = stats.size;
        } catch (e) {}
        console.log(`Processing media: Name: ${sourceName}, Mime: ${mimeType}, Size: ${Math.round(fileSizeInBytes / 1024)} KB`);

        if (filePathToUpload && fs.existsSync(filePathToUpload)) {
          try {
            console.log(`[رفع الملف] جاري رفع الملف لقاء المحاكاة الصوتية بجوهر Gemini File API... المسمى: ${sourceName}`);
            fileUpload = await ai.files.upload({
              file: filePathToUpload,
              config: {
                mimeType: mimeType,
              }
            });
            console.log(`[رفع الملف] تم الرفع بنجاح! الرابط المعرف بـ: ${fileUpload.uri}`);
          } finally {
            // Clean up temporary local file if needed
            if (needsCleanup) {
              try {
                fs.unlinkSync(filePathToUpload);
              } catch (unlinkErr) {
                console.error("Failed to delete temp file:", unlinkErr);
              }
            }
          }
        }
      } else if (isPaste) {
        console.log(`Processing Pasted Text: ${sourceName} (${pastedText.length} chars of text)`);
      } else {
        console.log(`Processing YouTube Video: ${sourceName} (${youtubeTranscriptText.length} chars of transcript)`);
      }

      const systemPrompt = `أنت مفرغ نصوص فائق الدقة والأمانة.
مهمتك الوحيدة والأساسية: كتابة تفريغ نصي حرفي ومباشر (Verbatim Transcript) لكل الكلمات والعبارات والجمل المنطوقة في الملف الصوتي أو المرئي المرفق.

يرجى الالتزام الصارم وحرفياً بالقواعد التالية:
1. اكتب الكلمات والعبارات باللغة واللهجة التي يتكلم بها المتحدث مباشرة كما نطقها بلسانه تماماً (سواء كانت فصحى، عامية مصرية، عامية خليجية، عامية شامية، أو غيرها). يُمنع منعاً باتاً تحويل العامية إلى فصحى أو تعديل صياغة الجمل.
2. اكتب النص صافياً وحرفياً ككلام مباشر دون أي تعديل، أو حذف، أو تنقيح، أو تهذيب، أو تصحيح نحوي، أو إضافة تجميلية. نريد الكلمات الأصلية الصافية فقط.
3. لا تضف أي ملخصات، أو شروحات، أو استنتاجات، أو عناوين من عندك لم يذكرها المتحدث. لا تضع خطوطاً أو فقرات هيكلية وهمية.
4. رتب الكلام المفرغ في فقرات متناسقة تتبع تدفق وسياق حديث المتحدث الأصلي لتسهيل القراءة البصرية المباشرة والمتابعة.
5. إذا وجد متحدثون متعددون، ميز بينهم بوضوح (مثل: **المتحدث الأول:**، **المتحدث الثاني:**).`;

      const pasteFormatterPrompt = `أنت خبير هيكلة وتنسيق نصوص ملصقة محترف ومؤتمن.
تنبيه هام ومحوري: لا يوجد أي ملف صوتي أو فيديو مرفق في هذا الطلب، المدخل هو عبارة عن نص تفريغ جاهز ومكتوب مسبقاً من المتصفح أو بشكل يدوي.
مهمتك الأساسية هي فقط: إعادة هيكلة وتنسيق هذا النص المرفق ليكون منظمًا، بليغًا، مقروءًا ومريحًا للعين باستخدام لغة الماركداون (Markdown).

يرجى الالتزام التام بالقواعد الصارمة التالية:
1. حافظ على الكلمات والأبجدية كما هي تماماً دون أي تغيير أو تأليف أو إعادة صياغة أو حذف للفقرات أو الكلمات الهامة. النص مفرغ سلفاً، مهمتك الوحيدة هي التنسيق البصري والترتيب الجمالي فقط.
2. لا تقم أبداً بكتابة عبارات تذكر فيها "أستمع إلى الأوديو" أو "أشاهد الفيديو" أو "أستمع للقاء" أو "سأقوم بتفريغ المقطع الصوتي لك"، وتفادى هذه الأخطاء تفادياً تاماً؛ حيث لا يوجد مقطع صوتي في هذا الطلب بل هو نص مكتوب سلفاً، وعليك فقط تنسيقه وترتيبه متباعداً بفقرات ومربعات ومقاطع سهلة ومميزة بوضوح.
3. قسّم النص إلى فقرات متباعدة ومريحة للعين تتبع الأفكار الواردة في النص.
4. اصنع عناوين رئيسية وفرعية مناسبة لتسهيل القراءة والمراجعة البصرية.
5. لا تقم بتأليف أو تخمين أو تصميم معلومات خارجية أو استدلالات لم ترد في النص بتاتاً لضمان الصدق التام والأمانة المطلقة.`;

      let contents;
      if (isPaste) {
        contents = [
          {
            text: `هذا هو النص المفرغ المراد هيكلته وتنسيقه جمالياً دون تزييف:\n\n${pastedText}`
          },
          {
            text: pasteFormatterPrompt
          }
        ];
      } else if (isYoutube) {
        contents = [
          {
            text: `هذا هو التفريغ اللفظي التلقائي المستخرج من فيديو يوتيوب المسمى "${sourceName}":\n\n${youtubeTranscriptText}`
          },
          {
            text: systemPrompt
          }
        ];
      } else if (fileUpload) {
        contents = [
          {
            fileData: {
              fileUri: fileUpload.uri,
              mimeType: fileUpload.mimeType
            }
          },
          {
            text: systemPrompt
          }
        ];
      } else {
        contents = [
          {
            text: "يرجى تزويد ملف وسائط صالح للتفريغ الذكي."
          }
        ];
      }

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
          language: "العربية"
        }) + "\n");
        res.end();
      } catch (streamErr: any) {
        console.error("Error reading from Gemini stream:", streamErr);
        res.write(JSON.stringify({
          success: false,
          error: `⚠️ انقطع الاتصال بـ Gemini أثناء معالجة نصوص البث: ${streamErr.message || streamErr}`
        }) + "\n");
        res.end();
      } finally {
        if (fileUpload && fileUpload.name) {
          try {
            console.log(`[حذف الملف] جاري حذف الملف من خوادم Gemini لمراعاة الخصوصية... ${fileUpload.name}`);
            await ai.files.delete({ name: fileUpload.name });
            console.log(`[حذف الملف] تم حذف الملف بنجاح.`);
          } catch (deleteErr) {
            console.warn("Failed to delete file from Gemini Storage:", deleteErr);
          }
        }
      }

    } catch (error: any) {
      console.error("Transcription Handler Server Error:", error);
      return res.status(500).json({
        success: false,
        error: `حدث خلل أثناء تشغيل تفريغ الذكاء الاصطناعي: ${error.message || error}`
      });
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
