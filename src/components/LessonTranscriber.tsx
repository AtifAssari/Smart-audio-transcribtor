import React, { useState, useEffect, useRef } from "react";
import { Course, TranscriptionItem, ServerResponse } from "../types";
import { 
  X, 
  Upload, 
  Link2, 
  Sparkles, 
  FileAudio, 
  FileVideo, 
  Folder,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  FileText
} from "lucide-react";

interface LessonTranscriberProps {
  courses: Course[];
  selectedCourseId: string | null;
  onClose: () => void;
  onTranscriptionSuccess: (newItem: TranscriptionItem) => void;
  onCompressedFileAvailable?: (file: File) => void;
}

const RUNNING_LOGS_ARABIC = [
  "📥 جاري تلقي الملف تمهيداً لإرساله للذكاء الاصطناعي...",
  "🎧 يقوم نموذج Gemini حالياً ببدء الاستماع بدقة لكلام المتحدث...",
  "🧠 تحليل نبرة الكلام واستيعاب سياق الموضوع والدروس الفنية...",
  "📝 ترجمة الحروف وإزالة النطقات المكررة واللعثمات تلقائياً لصفاء النص...",
  "🏷️ تحديد ما إذا كان اللقاء ككتلة موضوعية واحدة أو يحتاج لعناوين فرعية...",
  "🌟 تركيب العناوين الرئيسية والفرعية وصياغة نقاط التعداد المهمة...",
  "✍️ صياغة الملخص السريع المفصل في مقدمة الدرس لسهولة المراجعة...",
  "⚡ تنسيق محاذاة النص العربي وتطبيق قواعد تظليل ماركداون (Markdown) جمالياً...",
  "🎨 تنقيح المظهر العام وجعل الفقرات متناغمة ومريحة للعينين...",
  "🚀 المقاطع الأخيرة تكتمل الآن.. أوشكنا على وضع اللمسات النهائية!"
];

const RUNNING_LOGS_PASTE_ARABIC = [
  "📥 جاري استقبال النص المكتوب للبدء الهيكلي...",
  "📝 يقوم الذكاء الاصطناعي حالياً بقراءة الكلمات والتعرف على سياق الموضوع...",
  "⚡ ترتيب الفقرات وتنظيم المحتوى وفقاً لأفضل ممارسات الكتابة العربية...",
  "🏷️ تصميم وإنشاء عناوين رئيسية وفرعية مناسبة للموضوع...",
  "🌟 فرز الأفكار الجوهرية وصياغتها بنظام النقاط التعدادية الأنيقة...",
  "🎨 تطبيق قواعد لغة الماركداون (Markdown) لإبراز الجمل والكلمات الهامة...",
  "✍️ صيانة تماسك الفقرات ليصبح النص غنياً وسهل القراءة بصرية...",
  "🚀 المراجعة النهائية تكتمل الآن.. أوشكنا على وضع اللمسات التجميلية!"
];

export default function LessonTranscriber({
  courses,
  selectedCourseId,
  onClose,
  onTranscriptionSuccess,
  onCompressedFileAvailable
}: LessonTranscriberProps) {
  const [courseId, setCourseId] = useState(selectedCourseId || "");
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<'file' | 'url' | 'paste'>('file');
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLogIndex, setLoadingLogIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [streamingProgress, setStreamingProgress] = useState("");

  // Local compression states
  const [compressLocally, setCompressLocally] = useState(true);
  const [localProcessingStatus, setLocalProcessingStatus] = useState("");
  const [isLocalProcessing, setIsLocalProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotate loading logs for interactive patience stimulation
  useEffect(() => {
    let interval: any;
    const currentLogsLength = sourceType === 'paste' ? RUNNING_LOGS_PASTE_ARABIC.length : RUNNING_LOGS_ARABIC.length;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingLogIndex((prev) => (prev + 1) % currentLogsLength);
      }, 5500);
    } else {
      setLoadingLogIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading, sourceType]);

  // Set default course ID if it changes
  useEffect(() => {
    if (selectedCourseId) {
      setCourseId(selectedCourseId);
    } else if (courses.length > 0 && !courseId) {
      setCourseId(courses[0].id);
    }
  }, [selectedCourseId, courses]);

  const MAX_RAW_FILE_SIZE_MB = 22; // Direct upload threshold for Cloud Run (32MB limit, safe margin 22MB to avoid base64 overhead)
  const MAX_INPUT_FILE_SIZE_MB = 150; // Browser local decoding limit (reduced to avoid Web Audio API Memory limits)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const fileSizeInMB = selectedFile.size / (1024 * 1024);
      
      const allowedLimit = compressLocally ? MAX_INPUT_FILE_SIZE_MB : MAX_RAW_FILE_SIZE_MB;
      if (fileSizeInMB > allowedLimit) {
        if (compressLocally) {
          setErrorMessage(`⚠️ حجم الملف كبير جداً (${fileSizeInMB.toFixed(1)} ميجابايت). الحد الأقصى للمستوردات مع تفعيل خيار الضغط محلياً هو ${MAX_INPUT_FILE_SIZE_MB} ميجابايت.`);
        } else {
          setErrorMessage(`⚠️ حجم الملف (${fileSizeInMB.toFixed(1)} ميجابايت) يتجاوز الحد الأقصى للرفع المباشر الخالي من الضغط (${MAX_RAW_FILE_SIZE_MB} ميجابايت). يرجى التكرم بتفعيل خيار "الضغط المحلي" أولاً لمساندة الملفات الكبيرة والضخمة وسحلها بنجاح.`);
        }
        setFile(null);
        return;
      }
      setErrorMessage("");
      setFile(selectedFile);
      if (!title) {
        // Strip file extension to use as a smart default title
        const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
        setTitle(baseName);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      // Basic check if it's audio or video
      if (selectedFile.type.startsWith('audio/') || selectedFile.type.startsWith('video/')) {
        const fileSizeInMB = selectedFile.size / (1024 * 1024);
        const allowedLimit = compressLocally ? MAX_INPUT_FILE_SIZE_MB : MAX_RAW_FILE_SIZE_MB;
        if (fileSizeInMB > allowedLimit) {
          if (compressLocally) {
            setErrorMessage(`⚠️ حجم الملف كبير جداً (${fileSizeInMB.toFixed(1)} ميجابايت). الحد الأقصى مع تفعيل الضغط محلياً هو ${MAX_INPUT_FILE_SIZE_MB} ميجابايت.`);
          } else {
            setErrorMessage(`⚠️ الملف (${fileSizeInMB.toFixed(1)} ميجابايت) يتجاوز الحد الأقصى للرفع المباشر الخالي من الضغط (${MAX_RAW_FILE_SIZE_MB} ميجابايت). يرجى تفعيل خيار "الضغط المحلي" لمعالجة وتخفيف الملف بنسبة 90% لتسهيل تفريغه.`);
          }
          setFile(null);
          return;
        }
        setErrorMessage("");
        setFile(selectedFile);
        if (!title) {
          const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
          setTitle(baseName);
        }
      } else {
        setErrorMessage("يرجى سحب وإفلات ملف صوتي أو مرئي مدعوم كـ MP3 أو MP4 فقط.");
      }
    }
  };

  // WAV writing helpers
  const writeStringHelper = (view: DataView, offset: number, stringStr: string) => {
    for (let i = 0; i < stringStr.length; i++) {
      view.setUint8(offset + i, stringStr.charCodeAt(i));
    }
  };

  const bufferToWav = (audioBuffer: AudioBuffer): Blob => {
    const numOfChan = 1; // force mono
    const sampleRate = 16000; // Gemini speech optimizations
    const format = 1; // raw PCM
    const bitDepth = 16;
    
    let samples: Float32Array;
    if (audioBuffer.sampleRate === sampleRate) {
      samples = audioBuffer.getChannelData(0);
    } else {
      // Linear interpolation downsampler
      const originalRate = audioBuffer.sampleRate;
      const ratio = originalRate / sampleRate;
      const originalData = audioBuffer.getChannelData(0);
      const newLength = Math.round(originalData.length / ratio);
      samples = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        samples[i] = originalData[Math.min(Math.round(i * ratio), originalData.length - 1)];
      }
    }

    const result = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const arrayBuf = new ArrayBuffer(44 + result.length * 2);
    const view = new DataView(arrayBuf);

    writeStringHelper(view, 0, 'RIFF');
    view.setUint32(4, 36 + result.length * 2, true);
    writeStringHelper(view, 8, 'WAVE');
    writeStringHelper(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, bitDepth, true);
    writeStringHelper(view, 36, 'data');
    view.setUint32(40, result.length * 2, true);

    for (let i = 0; i < result.length; i++) {
      view.setInt16(44 + i * 2, result[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const extractAudioLocally = async (inputFile: File): Promise<File> => {
    setIsLocalProcessing(true);
    setLocalProcessingStatus("📥 جاري قراءة بيانات الملف من الذاكرة المحلية...");
    
    try {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result instanceof ArrayBuffer) {
            resolve(e.target.result);
          } else {
            reject(new Error("فشل قراءة الملف كبنية ArrayBuffer"));
          }
        };
        reader.onerror = () => reject(new Error("حدث خطأ أثناء قراءة الملف من جهازك."));
        
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setLocalProcessingStatus(`📥 جاري قراءة بيانات الملف المحدّد في الذاكرة الموقتة (${pct}%)...`);
          }
        };
        
        reader.readAsArrayBuffer(inputFile);
      });

      setLocalProcessingStatus("⚙️ جاري تشغيل وحدة فك الترميز الصوتي في المتصفّح...");
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("المتصفح الحالي لا يدعم تقنية Web Audio API لفك الترميز محلياً.");
      }
      
      const audioCtx = new AudioCtx();
      setLocalProcessingStatus("🧠 جاري استخراج المسار الصوتي وتفكيك ذبذبات الفيديو...");
      
      let decodedBuffer: AudioBuffer;
      try {
        decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr: any) {
        console.error("Decoding error:", decodeErr);
        throw new Error("فشل المتصفح في استخراج الصوت من هذا الملف. يرجى التأكد من أنه ملف مرئي أو مسموع صالح وعير تالف.");
      } finally {
        await audioCtx.close();
      }

      setLocalProcessingStatus("⚡ جاري ضغط ذبذبات الصوت وتحويلها إلى أحادي خفيف (16kHz Mono WAV)...");
      
      const wavBlob = bufferToWav(decodedBuffer);
      
      const originalNameWithoutExt = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || inputFile.name;
      const compressedFile = new File([wavBlob], `${originalNameWithoutExt}_audio.wav`, {
        type: "audio/wav",
        lastModified: Date.now()
      });
      
      const originalSize = (inputFile.size / (1024 * 1024)).toFixed(1);
      const compressedSize = (compressedFile.size / (1024 * 1024)).toFixed(1);
      console.log(`Local extraction succeeded: ${originalSize}MB -> ${compressedSize}MB`);
      
      return compressedFile;
      
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || "فشلت عملية الضغط المحلي.");
    } finally {
      setIsLocalProcessing(false);
      setLocalProcessingStatus("");
    }
  };

  const handleTranscribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      setErrorMessage("يرجى تحديد المجلد/كورس لحفظ المخرجات بداخله.");
      return;
    }
    if (sourceType === 'file' && !file) {
      setErrorMessage("يرجى اختيار ملف صوتي أو فيديو من جهازك.");
      return;
    }
    if (sourceType === 'url' && !url.trim()) {
      setErrorMessage("يرجى كتابة رابط مباشر صالح لملف الميديا.");
      return;
    }
    if (sourceType === 'paste' && !pastedText.trim()) {
      setErrorMessage("يرجى لصق نصوص التفريغ المراد هيكلتها.");
      return;
    }

    setErrorMessage("");

    let fileToUpload = file;
    if (sourceType === 'file' && file) {
      if (compressLocally) {
        try {
          const compFile = await extractAudioLocally(file);
          fileToUpload = compFile;
          if (onCompressedFileAvailable) {
            onCompressedFileAvailable(compFile);
          }
        } catch (localErr: any) {
          setErrorMessage(`⚠️ تعذر تسييل وتخفيف الصوت محلياً: ${localErr.message}. يمكنك إلغاء خيار "الضغط المحلي" ومحاولة الرفع المباشر إذا كان حجم ملفك صغيراً جداً.`);
          return;
        }
      } else {
        const fileSizeInMB = file.size / (1024 * 1024);
        if (fileSizeInMB > MAX_RAW_FILE_SIZE_MB) {
          setErrorMessage(`⚠️ حجم الملف المستورد (${fileSizeInMB.toFixed(1)} ميجابايت) يتجاوز سقف الرفع المباشر بدون ضغط (${MAX_RAW_FILE_SIZE_MB} ميجابايت). يرجى التفضل بتفعيل خيار "الضغط المحلي" أولاً لتسييل وضغط الملف بمقدار 10 أضعاف ورفعه بنجاح.`);
          return;
        }
      }

      // Safeguard check for final payload size output from browser before hitting server limits
      if (fileToUpload) {
        const finalUploadSizeMB = fileToUpload.size / (1024 * 1024);
        if (finalUploadSizeMB > MAX_RAW_FILE_SIZE_MB) {
          setErrorMessage(
            `⚠️ حجم مستخلص الصوت المراد رفعه (${finalUploadSizeMB.toFixed(1)} ميجابايت) يتجاوز السقف الفني لرفع الميديا على منصة السحاب (${MAX_RAW_FILE_SIZE_MB} ميجابايت) لتجنب انقطاع الشبكة.\n\n` +
            `📌 للحل البديل والأدق لتفريغ المواد فائقة الطول والضخامة:\n` +
            `ننصح بـ: تقسيم الملف الصوتي/الفيديو الطويل إلى أجزاء أصغر (مثلاً كل مقطع 15 دقيقة) وتفريغ كل جزء كمقطع مستقل، أو استخدام خيار روابط يوتيوب أو روابط ميديا مباشرة!`
          );
          return;
        }
      }
    }

    setIsLoading(true);
    setStreamingProgress("");

    const formData = new FormData();
    formData.append("courseId", courseId);
    
    const finalTitle = title.trim() || (sourceType === 'file' ? file?.name : sourceType === 'paste' ? "نص ملصق يدوي" : url.split('/').pop()) || "درس مفرغ غير مسمى";
    formData.append("title", finalTitle);

    if (sourceType === 'paste') {
      formData.append("text", pastedText.trim());
    } else if (sourceType === 'file' && fileToUpload) {
      formData.append("file", fileToUpload);
    } else {
      formData.append("url", url.trim());
    }

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });

      let resData: any = {};
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/x-ndjson")) {
        if (!response.body) {
          throw new Error("لم يعثر المتصفح على دفق بيانات التفريغ اللحظي من الخادم.");
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let done = false;
        let cumulativeText = "";
        let finalResult: any = null;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // retain incomplete line

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.success === false) {
                  throw new Error(parsed.error || "فشل تفريغ الذكاء الاصطناعي أثناء معالجة دفق المحتوى.");
                }
                if (parsed.text) {
                  cumulativeText += parsed.text;
                  const estimatedWordCount = Math.round(cumulativeText.length / 5);
                  setStreamingProgress(`✍️ جاري استلام التفريغ اللحظي... تم تفريغ ${estimatedWordCount} كلمة حتى الآن.`);
                }
                if (parsed.done) {
                  finalResult = parsed;
                }
              } catch (parseErr: any) {
                if (parseErr.message && (parseErr.message.startsWith("⚠️") || parseErr.message.includes("فشل"))) {
                  throw parseErr;
                }
              }
            }
          }
        }

        if (finalResult && finalResult.success) {
          resData = finalResult;
        } else if (cumulativeText.trim()) {
          resData = {
            success: true,
            transcription: cumulativeText,
            summary: "",
            sourceName: finalTitle,
            language: "العربية"
          };
        } else {
          throw new Error("لم يتم استلام نصوص تفريغ مكتملة وصالحة من المودل.");
        }

      } else if (contentType.includes("application/json")) {
        try {
          resData = await response.json();
        } catch (jsonErr) {
          throw new Error("فشل في قراءة الاستجابة كترجمة JSON صالحة.");
        }
      } else {
        const textResponse = await response.text();
        const snippet = textResponse.length > 200 ? textResponse.substring(0, 200) + "..." : textResponse;
        
        // Check for 413 Payload Too Large explicitly in HTML output
        if (response.status === 413 || textResponse.includes("413") || textResponse.toLowerCase().includes("request entity too large") || textResponse.toLowerCase().includes("too large")) {
          throw new Error(
            `⚠️ حجم مستخلص أوديو الملف يتجاوز الحد الأقصى المسموح برَفعه لمنصة السحاب المباشرة (${MAX_RAW_FILE_SIZE_MB} ميجابايت).\n\n` +
            `💡 الحل: يرجى تفعيل الزر الأخضر بالأسفل "التحويل وتسييل الصوت محلياً بالجهاز (آمن، يوفر النت والرفع بنسبة 90%)" قبل الضغط على زر البدء لتقليص الحجم أوتوماتيكياً بمقدار 10 أضعاف ورفعه بنجاح.`
          );
        }
        
        const isHtml = textResponse.trim().startsWith("<!doctype") || textResponse.trim().startsWith("<html") || textResponse.toLowerCase().includes("<!doctype html>");
        if (isHtml) {
          throw new Error(
            "⚠️ تعذر استلام استجابة التفريق اللغوي بنجاح (الخادم استجاب بصفحة ويب بدلاً من رد بيانات الحوسبة).\n\n" +
            "💡 الأسباب الشائعة والمقترحات:\n" +
            "1. انقطاع الاتصال أو بطء شبكة الرفع عند معالجة الملفات الضخمة. يُنصح بشدة بتفعيل زر 'التحويل وتسييل الصوت محلياً بالجهاز' بالأسفل.\n" +
            "2. حد الرفع الأقصى: إذا تيقّنت أن حجم الملف الصوتي كبير جداً (محاضرة لأكثر من ساعة)، فالحل المثالي والأبسط هو تقسيم الملف أونلاين إلى أجزاء صغيرة (مثلاً 15 دقيقة) وتفريغ كل جزء كملف مستقل وسريع، أو إرفاق رابط يوتيوب مباشر.\n" +
            "3. الخادم يمر بفترة إعادة تشغيل قصيرة جداً. جرب الضغط على زر الارسال مرة أخرى بعد ثوانٍ قليلة."
          );
        }
        
        if (!response.ok) {
          throw new Error(`خطأ في السيرفر (كود ${response.status}): ${snippet}`);
        } else {
          throw new Error(`تلقى التطبيق استجابة غير متوقعة بتنسيق غير مدعوم من السيرفر: ${snippet}`);
        }
      }

      if (!response.ok) {
        throw new Error(resData.error || `فشل السيرفر في تنفيذ طلب التفريغ (كود ${response.status}).`);
      }

      if (resData.success) {
        const newLessonItem: TranscriptionItem = {
          id: `lesson_${Date.now()}`,
          courseId: courseId,
          title: finalTitle,
          sourceType: sourceType,
          sourceName: sourceType === 'file' ? (file?.name || "ملف") : sourceType === 'paste' ? "نصوص ملصقة يدوياً" : url,
          transcription: resData.transcription,
          summary: resData.summary,
          language: resData.language || "العربية",
          createdAt: new Date().toISOString()
        };
        onTranscriptionSuccess(newLessonItem);
        onClose();
      } else {
        throw new Error(resData.error || "استجابة غير متوقعة من المودل.");
      }

    } catch (err: any) {
      console.error(err);
      let friendlyError = err.message || "حدث عطل غير متوقع أثناء الاتصال بخوادم التفريغ الذكي.";
      
      // Map generic "failed to fetch" network errors which are caused by browser uploads dropping on oversized requests
      if (friendlyError.toLowerCase().includes("failed to fetch") || friendlyError.toLowerCase().includes("fetch failed")) {
        friendlyError = "⚠️ تعذر الاتصال أو انقطع الرفع (Failed to fetch).\n\nيرجع هذا الغالب لرفع ملف ميديا ضخم تخطى جدر الحماية، أو بسبب ثقل في جودة اتصال الإنترنت لديك.\n\n💡 من فضلك تأكد من تفعيل مفتاح الأخضر 'تحويل وتسييل الصوت محلياً بالجهاز' بالأسفل، واحرص على استخدام ملفات تفريغ أقصر كأفضل ممارسة!";
      } else if (friendlyError.includes("413") || friendlyError.toLowerCase().includes("request entity too large") || friendlyError.toLowerCase().includes("too large")) {
        friendlyError = "⚠️ تم رفض الرفع بسبب الحجم الزائد (Request Entity Too Large / 413).\n\nيرجى تفعيل مفتاح 'تحويل وتسييل الصوت محلياً بالجهاز' المتاح باللون الأخضر، فذلك يقوم بضغط حجم الأوديو بنسبة تفوق الـ 90% لتسهيل تفريغه وسحله بنجاح وفوراً.";
      }
      
      setErrorMessage(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 no-print">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-800">تفريغ درس أو كورس ذكي بالذكاء الاصطناعي</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading Overlay State */}
        {isLoading || isLocalProcessing ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-6 text-center bg-emerald-50/20 overflow-y-auto">
            {/* Spinning Indicator */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                <Sparkles className="w-7 h-7 animate-bounce" />
              </div>
            </div>

            <div className="space-y-3 max-w-sm">
              <h3 className="font-bold text-slate-800 text-sm">
                {isLocalProcessing ? "جاري استخراج وضغط الصوت محلياً..." : (sourceType === 'paste' ? "جاري تنسيق وترتيب النص ذكياً..." : "جاري التفريغ وصياغة البنية الذكية...")}
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                {isLocalProcessing 
                  ? "يتم الآن قراءة الملف وفصل الصوت وضغطه إلى صيغة WAV أحادية لتوفير استهلاك الإنترنت بنسبة تفوق 90% وضمان رفع فوري ناجح." 
                  : sourceType === 'paste' 
                    ? "الرجاء المكوث قليلاً بينما يقوم الذكاء الاصطناعي بقراءة النص وهيكلته بذكاء وتجميل نبراته لغوياً وتنسيق عناصره."
                    : "الرجاء عدم إغلاق هذه النافذة أو مغادرة الصفحة. تستغرق المعالجة من 30 ثانية إلى دقيقتين بحسب طول المادة الصوتية."}
              </p>
            </div>

            {/* Smart Rotating Log Message */}
            <div className="w-full max-w-xs bg-white/80 border border-slate-100 shadow-sm p-3.5 rounded-xl min-h-[70px] flex items-center justify-center">
              <p className="text-xs font-semibold text-emerald-800 leading-relaxed animate-fadeIn">
                {isLocalProcessing ? localProcessingStatus : (streamingProgress || (sourceType === 'paste' ? RUNNING_LOGS_PASTE_ARABIC[loadingLogIndex] : RUNNING_LOGS_ARABIC[loadingLogIndex]))}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleTranscribeSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed whitespace-pre-line">{errorMessage}</span>
              </div>
            )}

            {/* Folder Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-emerald-600" />
                اختر مجلد الحفظ المسبق
              </label>
              <select
                required
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all text-slate-700 font-semibold"
              >
                <option value="" disabled>--- اختر المجلد أو الكورس الحاضن ---</option>
                {courses.filter(c => !c.parentId).map(parent => (
                  <React.Fragment key={parent.id}>
                    <option value={parent.id}>{parent.name} (مجلد رئيسي)</option>
                    {courses.filter(c => c.parentId === parent.id).map(sub => (
                      <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name} (مجلد فرعي)</option>
                    ))}
                  </React.Fragment>
                ))}
              </select>
              {courses.length === 0 && (
                <p className="text-xxs text-red-500 mt-1">يجب عليك إنشاء مجلد/كورس واحد على الأقل في القائمة الجانبية أولاً.</p>
              )}
            </div>

            {/* Custom Lesson Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">عنوان الملف / المحاضرة المفرغة</label>
              <input
                type="text"
                placeholder="مثال: الدرس الأول - فك عقد الأساسيات"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Source Selector Tab */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-600">مصدر الصوت والمستوردات</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setSourceType('file')}
                  className={`flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    sourceType === 'file' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  تحميل ملف
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('url')}
                  className={`flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    sourceType === 'url' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Link2 className="w-3 h-3" />
                  رابط ميديا
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('paste')}
                  className={`flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    sourceType === 'paste' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  لصق نص تفريغ
                </button>
              </div>
            </div>

            {/* Tab: Direct Transcript Text Paste */}
            {sourceType === 'paste' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-semibold text-slate-500">منطقة لصق نصوص التفريغ (تفريغ المتصفح/صناعة يدوية)</label>
                <textarea
                  required
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="اصنع أو انسخ النص المفرغ يدوياً من تمديدات متصفح كروم أو الترجمة التلقائية هنا، ليقوم الذكاء الاصطناعي بتنقيط المقاطع، بناء عناوين الماركداون، وتنسيقه جمالياً..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none leading-relaxed bg-white"
                />
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xxs text-slate-500 flex items-start gap-1.5 leading-relaxed">
                  <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                  <span>تلميح تمديد المتصفح: يمكنك تفريغ أي فيديو على يوتيوب عبر تمديد متصفح كروم المفضل لديك، ثم نسخ النص التفريغي ووضعه هنا ليقوم التطبيق بتدقيقه، صياغة عناوينه وهيكلته فوراً بدقة 100%!</span>
                </div>
              </div>
            )}

            {/* Tab: File Upload */}
            {sourceType === 'file' && (
              <div 
                className="space-y-1.5 animate-fadeIn"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-emerald-500/80 bg-slate-50 hover:bg-emerald-50/10 cursor-pointer p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 transition-all group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="audio/*,video/*"
                    className="hidden"
                  />
                  {file ? (
                    <>
                      {file.type.startsWith('video/') ? (
                        <FileVideo className="w-10 h-10 text-emerald-600 animate-pulse" />
                      ) : (
                        <FileAudio className="w-10 h-10 text-emerald-600 animate-pulse" />
                      )}
                      <p className="text-xs font-semibold text-slate-800 truncate max-w-xs">{file.name}</p>
                      <span className="text-xxs text-slate-400 font-medium">{(file.size / (1024 * 1024)).toFixed(2)} MB • تغيير الملف بقرة واحدة</span>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-white border border-slate-150 rounded-xl group-hover:scale-110 group-hover:bg-emerald-50 transition-all duration-300">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-500" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">اسحب الملف الصوتي أو المرئي هنا، أو انقر للتصفح</p>
                      <span className="text-xxs text-slate-400 block font-medium">يدعم صيغ MP3, WAV, M4A, AAC, MP4 وغيرها بحجم أقصى {MAX_INPUT_FILE_SIZE_MB}MB</span>
                    </>
                  )}
                </div>

                {/* Local Compression Config Toggle */}
                <div className="pt-1 flex items-center justify-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-emerald-50/80 hover:bg-emerald-100/60 border border-emerald-150/55 p-2 rounded-xl transition-all w-full justify-center">
                    <input
                      type="checkbox"
                      checked={compressLocally}
                      onChange={(e) => {
                        setCompressLocally(e.target.checked);
                        // Clear file if it violates boundaries when turning off compression
                        if (!e.target.checked && file && (file.size / (1024 * 1024) > MAX_RAW_FILE_SIZE_MB)) {
                          setFile(null);
                          setErrorMessage(`⚠️ تم إلغاء تحديد الملف السابق لأن حجمه يتجاوز حد الرفع المباشر (${MAX_RAW_FILE_SIZE_MB} ميجابايت) بدون ضغط محلّي للملف.`);
                        }
                      }}
                      className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-emerald-800 select-none">
                      ⚡ تحويل وتسييل الصوت محلياً بالجهاز (آمن، يوفر النت والرفع بنسبة 90%)
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Tab: URL Input */}
            {sourceType === 'url' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-medium text-slate-500">منظومة استيراد الروابط المباشرة</label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://example.com/lecture.mp3"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full text-xs pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-left"
                    dir="ltr"
                  />
                  <Link2 className="absolute right-3.5 top-3 w-4 h-4 text-slate-450" />
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xxs text-slate-500 flex items-start gap-1.5 leading-relaxed">
                  <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                  <span>تنويه: يستضيف محرك Gemini ملفات الصوت/الفيديو المباشرة المنقوشة بروابط تحميل مباشرة، تأكد أن الرابط ينتهي بصيغة صوتية مثل .mp3 أو .m4a أو مرئية كـ .mp4.</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                إغلاق
              </button>
              <button
                type="submit"
                disabled={courses.length === 0 || (sourceType === 'file' && !file) || (sourceType === 'url' && !url.trim()) || (sourceType === 'paste' && !pastedText.trim())}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-350 disabled:text-slate-400 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {sourceType === 'paste' ? "ابدأ هيكلة وتنسيق النص" : "ابدأ تفقيد وتفريغ الصوت"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
