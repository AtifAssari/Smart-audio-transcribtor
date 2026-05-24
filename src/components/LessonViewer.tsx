import React, { useState, useEffect } from "react";
import { TranscriptionItem, Course } from "../types";
import Markdown from "react-markdown";
import { 
  FileText, 
  Copy, 
  ArrowDownToLine, 
  Printer, 
  Edit3, 
  Check, 
  Search, 
  FileCode, 
  Award,
  BookOpen,
  Calendar,
  AlertCircle
} from "lucide-react";

interface LessonViewerProps {
  lesson: TranscriptionItem;
  course: Course | undefined;
  courses?: Course[];
  tempFile?: { file: File; url: string; expiresAt: number } | null;
  onUpdateLesson: (id: string, updatedFields: Partial<TranscriptionItem>) => void;
  onDeleteLesson: (id: string) => void;
}

export default function LessonViewer({
  lesson,
  course,
  courses = [],
  tempFile,
  onUpdateLesson,
  onDeleteLesson
}: LessonViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(lesson.transcription);
  const [editTitle, setEditTitle] = useState(lesson.title);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [tempRenameTitle, setTempRenameTitle] = useState(lesson.title);

  // Sync edits if selected lesson changes
  useEffect(() => {
    setEditText(lesson.transcription);
    setEditTitle(lesson.title);
    setIsEditing(false);
    setSearchQuery("");
    setIsConfirmingDelete(false);
    setIsRenamingTitle(false);
    setTempRenameTitle(lesson.title);
  }, [lesson]);

  // Flash notification helper
  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3500);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(lesson.transcription);
      setCopied(true);
      triggerNotification("📋 تم نسخ النص بالكامل إلى الحافظة بنجاح!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      triggerNotification("⚠️ فشل في نسخ النص تلقائياً.");
    }
  };

  const handleSaveEdits = () => {
    onUpdateLesson(lesson.id, { title: editTitle, transcription: editText });
    setIsEditing(false);
    triggerNotification("💾 تم حفظ التعديلات المحلية بنجاح.");
  };

  const handleSaveTitle = () => {
    if (tempRenameTitle.trim()) {
      onUpdateLesson(lesson.id, { title: tempRenameTitle.trim() });
      setIsRenamingTitle(false);
      triggerNotification("📝 تم تغيير اسم الملف بنجاح.");
    }
  };

  const sanitizeFilename = (name: string) => {
    return name
      .replace(/[\\/:*?"<>|]/g, "") // remove forbidden OS file characters
      .trim() || "ملف";
  };

  const convertMarkdownToHtml = (md: string) => {
    let html = md;
    
    // Protect XML characters
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Replace Markdown headers
    html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
    html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
    html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
    html = html.replace(/^#### (.*?)$/gm, "<h4>$1</h4>");
    
    // Replace Markdown bold / italic
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Replace horizontal rules
    html = html.replace(/^---$/gm, "<hr />");

    // Clean up empty lines or lists
    const lines = html.split("\n");
    let inList = false;
    const outputLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        const content = trimmed.substring(2);
        let prefix = "";
        if (!inList) {
          inList = true;
          prefix = "<ul dir='rtl' style='text-align: right;'>";
        }
        return prefix + `<li>${content}</li>`;
      } else {
        let suffix = "";
        if (inList) {
          inList = false;
          suffix = "</ul>";
        }
        if (trimmed && !trimmed.startsWith("<h") && !trimmed.startsWith("<l") && !trimmed.startsWith("<u") && !trimmed.startsWith("<p")) {
          return suffix + `<p>${trimmed}</p>`;
        }
        return suffix + line;
      }
    });

    if (inList) {
      outputLines.push("</ul>");
    }

    return outputLines.join("\n");
  };

  const exportMarkdown = () => {
    const blob = new Blob([lesson.transcription], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const folderName = course?.name ? sanitizeFilename(course.name) : "مجلد";
    const fileName = sanitizeFilename(lesson.title);
    link.download = `${folderName} - ${fileName}.md`;
    
    link.click();
    URL.revokeObjectURL(url);
    triggerNotification("📥 تم تصدير ملف Markdown (.md) بنجاح.");
  };

  const exportWord = () => {
    const htmlBodyContent = convertMarkdownToHtml(lesson.transcription);
    
    const wordDocument = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>${lesson.title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          direction: rtl;
          unicode-bidi: embed;
          line-height: 1.6;
          padding: 24pt;
        }
        h1 { font-size: 20pt; color: #047857; margin-bottom: 12pt; text-align: right; }
        h2 { font-size: 15pt; color: #1e293b; margin-top: 20pt; margin-bottom: 10pt; text-align: right; border-bottom: 1px solid #e2e8f0; padding-bottom: 4pt; }
        h3 { font-size: 12pt; color: #475569; margin-top: 15pt; margin-bottom: 8pt; text-align: right; }
        p { font-size: 10.5pt; color: #334155; margin-bottom: 8pt; text-align: right; line-height: 1.6; }
        ul, ol { direction: rtl; text-align: right; margin-bottom: 10pt; padding-right: 20pt; }
        li { font-size: 10.5pt; color: #334155; margin-bottom: 4pt; }
        hr { border: 0; border-top: 1px solid #cbd5e1; margin: 20pt 0; }
        .summary-box {
          background-color: #f0fdf4;
          border-right: 4px solid #059669;
          padding: 12pt;
          margin-bottom: 18pt;
        }
      </style>
    </head>
    <body style="direction: rtl;">
      <div class="summary-box">
        <h2 style="color: #065f46; margin-top: 0; border: none; padding: 0;">ملخص سريع</h2>
        <p>${lesson.summary || "تم تفريغ وهيكلة المحتوى."}</p>
      </div>
      <hr />
      ${htmlBodyContent}
    </body>
    </html>`;

    const blob = new Blob([wordDocument], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const folderName = course?.name ? sanitizeFilename(course.name) : "مجلد";
    const fileName = sanitizeFilename(lesson.title);
    link.download = `${folderName} - ${fileName}.doc`;
    
    link.click();
    URL.revokeObjectURL(url);
    triggerNotification("📥 تم تصدير ملف Word (.doc) بنجاح.");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateSummary = async () => {
    if (!lesson.transcription || !lesson.transcription.trim()) {
      triggerNotification("⚠️ لا يوجد نص كافٍ لتوليد الملخص.");
      return;
    }
    setIsSummarizing(true);
    triggerNotification("⚡ جاري استدعاء الذكاء الاصطناعي لتلخيص المحتوى المفرغ...");
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lesson.transcription })
      });
      
      let data: any = {};
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (jsonErr) {
          throw new Error("فشل في تفكيك استجابة تلخيص JSON.");
        }
      } else {
        const textResponse = await response.text();
        const isHtml = textResponse.trim().startsWith("<!doctype") || textResponse.trim().startsWith("<html") || textResponse.toLowerCase().includes("<!doctype html>");
        if (isHtml) {
          throw new Error("استجاب السيرفر بصفحة ويب بدلاً من حزمة بيانات. قد يكون السيرفر في وضع إعادة تشغيل سريع أو أن طول النص المفرغ فاق جدران الحماية.");
        }
        throw new Error(`استجابة غير متوقعة من السيرفر (كود ${response.status})`);
      }

      if (data.success && data.summary) {
        onUpdateLesson(lesson.id, { summary: data.summary });
        triggerNotification("✨ تم توليد ملخص الدرس الشامل وحفظه بنجاح!");
      } else {
        throw new Error(data.error || "استجابة غير متوقعة من السيرفر.");
      }
    } catch (err: any) {
      console.error(err);
      let friendlyError = err.message || "عطل في شبكة الاتصال.";
      if (friendlyError.toLowerCase().includes("failed to fetch") || friendlyError.toLowerCase().includes("fetch failed")) {
        friendlyError = "تعذر الاتصال بخوادم التلخيص (انقطاع مؤقت بالشبكة). يرجى إعادة المحاولة بعد ثوانٍ.";
      }
      triggerNotification(`⚠️ فشل التلخيص: ${friendlyError}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Safe search highlighting or query representation
  const searchResultsCount = () => {
    if (!searchQuery.trim()) return 0;
    const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    return (lesson.transcription.match(regex) || []).length;
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative">
      
      {/* Printable Sheet Wrapper (Hidden on screen, Visible on print) */}
      <div className="hidden print:block print-only p-12 text-slate-900" dir="rtl">
        <div className="border bg-emerald-50/10 border-emerald-100 p-6 rounded-xl mb-6">
          <h2 className="text-xl font-bold text-emerald-800 mb-2">ملخص مختصر للمقالة</h2>
          <p className="text-sm leading-relaxed text-slate-700">{lesson.summary || "تم التفريغ والتنظيم الهيكلي للمحتوى بنجاح."}</p>
        </div>
        <hr className="my-6 border-slate-200" />
        <div className="prose prose-slate max-w-none prose-emerald">
          <Markdown>{lesson.transcription}</Markdown>
        </div>
      </div>

      {/* Screen Interface */}
      <div className="flex flex-col h-full overflow-hidden no-print">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative group/folder text-xxs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-emerald-250 transition-all border border-emerald-200" title="انقر لنقل هذا الدرس لمجلد أو موضوع فرعي آخر">
                <BookOpen className="w-2.5 h-2.5" />
                <span>{course?.name || "مجلد غير مصنف"}</span>
                <span className="text-[9px] text-emerald-600 font-normal mr-1 border-r border-emerald-300/60 pr-1">(انقر للنقل)</span>
                
                <select
                  value={lesson.courseId}
                  onChange={(e) => {
                    const nextCourseId = e.target.value;
                    if (nextCourseId && nextCourseId !== lesson.courseId) {
                      onUpdateLesson(lesson.id, { courseId: nextCourseId });
                      triggerNotification("📂 تم نقل الملف بنجاح إلى المجلد والمستودع المحدد!");
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  {courses.map(c => {
                    const parent = c.parentId ? courses.find(p => p.id === c.parentId) : null;
                    const label = parent ? `${parent.name} ↳ ${c.name}` : c.name;
                    return (
                      <option key={c.id} value={c.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </span>
              <span className="text-xxs text-slate-400 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(lesson.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            {isRenamingTitle ? (
              <div className="flex items-center gap-1.5 py-0.5 animate-fadeIn">
                <input
                  type="text"
                  value={tempRenameTitle}
                  onChange={(e) => setTempRenameTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setIsRenamingTitle(false);
                  }}
                  className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-800 w-44 md:w-60"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded transition-all cursor-pointer"
                  title="حفظ الاسم"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsRenamingTitle(false)}
                  className="p-1 hover:bg-slate-100 text-slate-500 rounded transition-all text-xxs font-semibold px-1.5 cursor-pointer"
                  title="إلغاء التغيير"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title">
                <h2 className="text-sm font-bold text-slate-800 truncate max-w-[200px] md:max-w-xs" title={lesson.title}>
                  {lesson.title}
                </h2>
                <button
                  onClick={() => {
                    setTempRenameTitle(lesson.title);
                    setIsRenamingTitle(true);
                  }}
                  className="p-1 opacity-60 hover:opacity-100 text-slate-400 hover:text-emerald-600 rounded-md hover:bg-slate-200/50 transition-all duration-200 cursor-pointer"
                  title="تغيير اسم الملف"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Action Tools Panel */}
          <div className="flex items-center gap-2">
            
            {/* Search Tool within document */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث في التفريغ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg w-44 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
              <Search className="absolute right-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              {searchQuery.trim() && (
                <span className="absolute left-2.5 top-1.5 text-xxs bg-emerald-150 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  {searchResultsCount()}
                </span>
              )}
            </div>

            {/* Edit toggle */}
            <button
              onClick={() => {
                if (isEditing) handleSaveEdits();
                else setIsEditing(true);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                isEditing 
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {isEditing ? "حفظ التعديلات" : "تعديل النص"}
            </button>

            {/* Export Dropdown / Buttons */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              <button
                onClick={exportMarkdown}
                className="p-1 px-2 text-xxs font-bold text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded transition-all flex items-center gap-1 cursor-pointer"
                title="تصدير بصيغة Markdown"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>MD</span>
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                onClick={exportWord}
                className="p-1 px-2 text-xxs font-bold text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded transition-all flex items-center gap-1 cursor-pointer"
                title="تصدير بصيغة Word (.doc)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Word</span>
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                onClick={handlePrint}
                className="p-1 px-2 text-xxs font-bold text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded transition-all flex items-center gap-1 cursor-pointer"
                title="طباعة أو تصدير PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>

            <button
              onClick={handleCopyText}
              className={`p-1.5 rounded-lg border ${copied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'} transition-all`}
              title="نسخ النص الكامل"
            >
              <Copy className="w-4 h-4" />
            </button>

            {isConfirmingDelete ? (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg p-1 animate-fadeIn">
                <span className="text-xxs text-red-700 font-bold px-1">تأكيد حذف الدرس؟</span>
                <button
                  onClick={() => {
                    onDeleteLesson(lesson.id);
                    setIsConfirmingDelete(false);
                  }}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xxs rounded transition-all cursor-pointer"
                >
                  نعم، احذف
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xxs rounded transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="text-xxs font-bold text-red-500 hover:bg-red-50 border border-transparent hover:border-red-150 px-2 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                حذف
              </button>
            )}
          </div>
        </div>

        {/* Global Notification Banner */}
        {notification && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-25 flex items-center gap-2 animate-fadeIn border border-slate-700">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Main Area Scroll */}
        <div className="flex-grow overflow-y-auto flex">
          
          {/* Quick Info & Summary Drawer (Left/Right Pane) */}
          <div className="w-64 border-l border-slate-100 bg-slate-50/50 p-4 space-y-5 hidden lg:block overflow-y-auto flex-shrink-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Award className="w-4 h-4 text-emerald-600" />
              نظرة عامة ولغة الدرس
            </h3>

            {/* Stats Block */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xxs space-y-2">
              <div className="flex justify-between items-center text-xxs text-slate-500 leading-normal">
                <span>لغة الحديث المستنبطة:</span>
                <span className="font-bold text-slate-800">{lesson.language || "العربية"}</span>
              </div>
              <div className="flex justify-between items-center text-xxs text-slate-500 leading-normal">
                <span>مصدر البيانات:</span>
                <span className="font-bold text-slate-800">{lesson.sourceType === 'file' ? "ملف محلي" : "رابط إنترنت"}</span>
              </div>
              <div className="text-xxs text-slate-500 leading-normal border-t border-slate-50 pt-2 break-all font-mono text-left" dir="ltr">
                {lesson.sourceName}
              </div>

              {lesson.sourceType === 'file' && tempFile && tempFile.file.name === lesson.sourceName && (
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = tempFile.url;
                      link.download = tempFile.file.name;
                      link.click();
                      triggerNotification("📥 جاري تنزيل ملف الصوت المرفق بنجاح!");
                    }}
                    className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-850 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowDownToLine className="w-3 h-3" />
                    <span>تنزيل ملف الصوت المرفق</span>
                  </button>
                </div>
              )}

              {lesson.sourceType === 'file' && (!tempFile || tempFile.file.name !== lesson.sourceName) && (
                <div className="pt-2 border-t border-slate-100 mt-1">
                  <span className="text-[9px] text-slate-400 font-medium block text-right leading-relaxed font-sans">
                    🔒 تم مسح كاش الصوت مؤقتاً لحفظ مساحة المتصفح وخصوصية الشرح. يمكنك مراجعة الملخص وحفظ الدروس دائماً.
                  </span>
                </div>
              )}
            </div>

            {/* AI Summary Card */}
            <div className="bg-emerald-50/40 border border-emerald-50/90 p-4 rounded-2xl space-y-2.5">
              <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                ملخص الذكاء الاصطناعي
              </h4>
              {lesson.summary ? (
                <div className="space-y-2">
                  <p className="text-xxs leading-relaxed text-emerald-900/90 font-medium whitespace-pre-line select-text">
                    {lesson.summary}
                  </p>
                  <button
                    onClick={() => {
                      const blob = new Blob([lesson.summary || ""], { type: "text/plain;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `ملخص - ${sanitizeFilename(lesson.title)}.txt`;
                      link.click();
                      URL.revokeObjectURL(url);
                      triggerNotification("📥 تم تنزيل المستند للملخص بنجاح!");
                    }}
                    className="w-full py-1 px-2 bg-emerald-100 hover:bg-emerald-250 border border-emerald-300/30 text-emerald-800 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowDownToLine className="w-3 h-3" />
                    <span>تنزيل نسخة الملخص (.txt)</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xxs text-slate-500 leading-relaxed">
                    لم يتم إنشاء ملخص لهذا التفريغ بعد. التلخيص متاح كخدمة إضافية تطلبها متى شئت.
                  </p>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isSummarizing || !lesson.transcription}
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xxs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isSummarizing ? "⏳ جاري توليد الملخص..." : "✨ إنتاج ملخص بالذكاء الاصطناعي"}
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 border border-slate-200/50 rounded-xl text-slate-500 text-xxs leading-relaxed flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-slate-450 mt-0.5 flex-shrink-0" />
              <span>ملاحظة: يمكنك نقر زر 'تعديل النص' أعلاه لإصلاح أي أخطاء أو تعليق مكمل شخصي على الأفكار.</span>
            </div>
          </div>

          {/* Reading / Editing Canvas Area */}
          <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
            {isEditing ? (
              <div className="h-full flex flex-col space-y-3 select-text">
                <div className="flex items-center justify-between text-xxs text-slate-500 pb-1 border-b border-slate-105">
                  <span className="font-bold text-slate-600">أنت الآن في وضع التعديل المباشر (Markdown)</span>
                  <span>الرجاء استخدام براهين العناوين كـ # و ## و ### للتنظيم الفاخر.</span>
                </div>
                
                {/* Editable filename / title input */}
                <div className="flex flex-col space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="text-xxs font-bold text-slate-500">اسم الملف / عنوان التفريغ:</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-800 font-bold"
                  />
                </div>

                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 w-full text-xs p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 font-mono resize-none leading-relaxed text-slate-800"
                  dir="rtl"
                />
                <div className="flex justify-end gap-2.5">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(lesson.transcription);
                      setEditTitle(lesson.title);
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 border border-slate-200/50 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    حفظ الفهرس المحدث
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Visual Highlight search indicators if searching */}
                {searchQuery.trim() && (
                  <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xxs text-yellow-800 font-semibold flex items-center gap-1.5">
                    <span className="animate-ping w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                    <span>تم تحديد الكلمات المطابقة للمشاهدة السريعة. الاستطاعة تتمدد بالكامل في النص.</span>
                  </div>
                )}

                {/* Content Reader Pane */}
                <div className="prose prose-slate max-w-none prose-emerald selection:bg-emerald-100 select-text leading-loose text-slate-700 font-sans">
                  
                  {/* Styled Render of Markdown with RTL custom lists */}
                  <div className="lessons-transcription-render text-right font-medium text-sm text-slate-700 space-y-5">
                    <Markdown
                      components={{
                        h1: ({children}) => <h1 className="text-xl lg:text-3xl font-black text-emerald-800 leading-tight border-b border-slate-150 pb-3 mt-4 mb-4 tracking-tight">{children}</h1>,
                        h2: ({children}) => <h2 className="text-lg lg:text-xl font-black text-slate-800 leading-tight mt-8 mb-4 border-r-4 border-emerald-500 pr-3">{children}</h2>,
                        h3: ({children}) => <h3 className="text-base font-bold text-slate-600 mt-6 mb-2">{children}</h3>,
                        p: ({children}) => {
                          // Simple client search highlighting
                          if (searchQuery.trim() && typeof children === 'string') {
                            const query = searchQuery.trim();
                            const parts = children.split(new RegExp(`(${query})`, 'gi'));
                            return (
                              <p className="text-xs lg:text-sm text-slate-700 leading-relaxed mb-4 text-justify mt-1">
                                {parts.map((part, i) => 
                                  part.toLowerCase() === query.toLowerCase() 
                                    ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded font-bold px-0.5">{part}</mark> 
                                    : part
                                )}
                              </p>
                            );
                          }
                          return <p className="text-xs lg:text-sm text-slate-700 leading-relaxed mb-4 text-justify mt-1">{children}</p>;
                        },
                        ul: ({children}) => <ul className="list-disc list-inside pr-4 space-y-2 text-xs lg:text-sm mt-2 mb-4 text-slate-700" dir="rtl">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside pr-4 space-y-2 text-xs lg:text-sm mt-2 mb-4 text-slate-700" dir="rtl">{children}</ol>,
                        li: ({children}) => <li className="mb-1 leading-normal text-slate-700 font-semibold">{children}</li>,
                        blockquote: ({children}) => <blockquote className="border-r-4 border-slate-300 pr-4 italic text-slate-500 my-4 py-1 text-xs">{children}</blockquote>,
                        hr: () => <hr className="my-8 border-t-2 border-slate-100 border-dashed" />,
                        strong: ({children}) => <strong className="font-extrabold text-slate-900">{children}</strong>
                      }}
                    >
                      {lesson.transcription}
                    </Markdown>
                  </div>

                </div>

              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
