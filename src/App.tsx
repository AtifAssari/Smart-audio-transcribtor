import React, { useState, useEffect } from "react";
import { Course, TranscriptionItem } from "./types";
import Sidebar from "./components/Sidebar";
import LessonTranscriber from "./components/LessonTranscriber";
import LessonViewer from "./components/LessonViewer";
import { 
  Sparkles, 
  FolderPlus, 
  Layers, 
  Bookmark, 
  Plus, 
  Upload, 
  Tv, 
  Folder,
  Download,
  AlertCircle
} from "lucide-react";

const DEMO_COURSE_ID = "course_demo_default";
const DEMO_LESSON_ID = "lesson_demo_default";

const DEFAULT_DEMO_COURSE: Course = {
  id: DEMO_COURSE_ID,
  name: "🚀 دورة تجريبية: أساسيات تنظيم المعرفة",
  description: "مجلد افتراضي ترحيبي يستعرض ميزات التطبيق الذكي لتفريغ وتنظيم الصوتيات والمرئيات.",
  createdAt: new Date().toISOString()
};

const DEFAULT_DEMO_LESSON: TranscriptionItem = {
  id: DEMO_LESSON_ID,
  courseId: DEMO_COURSE_ID,
  title: "الدرس التوضيحي: كيف يفهم الذكاء الاصطناعي صوتك ويفرغه بهيكلية فريدة؟",
  sourceType: "url",
  sourceName: "https://example.com/smart-speech.mp3",
  language: "العربية",
  summary: "يوضح هذا الدرس طريقة تنضيد العناوين بطريقة ذكية، وأهمية تحويل المواد الصوتية والدروس إلى ملفات مقروءة ومرتبة لتبسيط المذاكرة وتنظيم المعلومات.",
  createdAt: new Date().toISOString(),
  transcription: `## 📝 ملخص سريع
يعد تحويل الحديث الصوتي والفيديو إلى نصوص مكتوبة ومنسقة بذكاء أهم وأنجز الممارسات لتوثيق وتثبيت العلم. تستعرض هذه المقالة التوضيحية كيفية تكامل السيرفر مع Gemini لإخراج نصوص ذات طابع هيكلي بليغ.
---
# تحويل الحديث إلى محتوى معرفي منظم بذكاء

أهلاً بك في نظام **مفرغ الصوتيات والدروس الذكي**. يعتمد هذا النظام على نموذج **Gemini 3.5 Flash** المتطور، والذي يتمتع بالقدرة على فهم ملفات الصوت والفيديو مباشرة (دون الحاجة لمحولات استماع وسيطة)، ويعيد ترتيب الكلمات بصياغة عربية فصيحة خالية من الأخطاء واللعثمات.

## 1. ذكاء الهيكلة: العناوين المنبثقة
أحد أهم المميزات في تفريغنا الذكي هو الفصل التلقائي لمسار المقابلة أو الشرح على أساس الأطروحة المذكورة:
* **العنونة التلقائية:** إذا قام المتحدث بشرح نقاط متعددة كـ (أولاً، ثانياً، مقارنة الأطراف)؛ يكتشف الذكاء في السيرفر هذه التفرعات ويصنع لها عناوين فرعية من الدرجة الثانية (##) لراحة القارئ.
* **الفقرة المتواصلة السلسة:** أما إن كان المتحدث يلقي خطبة أو يقرأ نصاً في تسلسل متصل دون وجود تبديل للأفكار (تسلسل الموضوع في كتلة واحدة)، فيترك النص في فقرات متناغمة وسهلة دون تقسيمات وهمية عشوائية.

## 2. آفاق التنظيم بحسب المجلدات والكورسات
يرتب النظام بياناتك على أساس **المجلدات (Folders / Courses)**، حيث يمكنك فصل كورساتك عن بعضها تماماً:
1. قم بإنشاء مجلد مثل (**كورس تطوير الويب**) أو (**ملتقى الموارد البشرية**).
2. اختر المجلد وقم برفع الصوتيات الخاصة به، ستتجمع كلها بشكل أنيق تحته دون اختلاطها بملفات مادة أخرى.

## 3. جدارة التصدير والطباعة الشاملة
نوفر خيارات فورية لتصدير التفريغ:
* **ملف وورد الوثيقي (.doc):** ينزل بترميز RTL (اتجاه كتابة عربي من اليمين لليسار) وتنسيق عناوين رسمي متوافق مباشرة مع برامج Office.
* **ملف Markdown كامل (.md):** مثالي للتعديل والحفظ داخل برامج الملاحظات الحديثة كـ Notion و Obsidian.
* **ملف PDF الطبيعي:** عن طريق ضغطة زر 'PDF' ستتفعل نافذة الطباعة المتناسقة التي تقوم بمسح كافة عناصر الموقع والأزرار، لتطبع التفريغ على نسق ورقة رسمية مطهرة ومصقولة المظهر.

---
**💡 نصيحة سريعة:** جرب النقر الآن على زر "**تعديل النص**" بالزاوية العلوية لتجربة تعديل هذا المحتوى كمسودة خاصة بك وحفظ الفهرس المحدث محلياً، أو قم بإنشاء مجلدك الأول من القائمة الجانبية وإرسال ملفك الصوتي لتفريغه وتصنيفه فوراً!`
};

export default function App() {
  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem("smart_transcriptions_courses");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing courses", e);
      }
    }
    return [DEFAULT_DEMO_COURSE];
  });

  const [lessons, setLessons] = useState<TranscriptionItem[]>(() => {
    // Collect active course IDs to prevent orphaned lessons from showing
    const activeCourseIds = new Set<string>();
    const savedCourses = localStorage.getItem("smart_transcriptions_courses");
    if (savedCourses) {
      try {
        const parsedCourses = JSON.parse(savedCourses);
        if (Array.isArray(parsedCourses)) {
          parsedCourses.forEach((c: any) => activeCourseIds.add(c.id));
        }
      } catch (e) {
        console.error("Error parsing courses for lessons filter", e);
      }
    } else {
      activeCourseIds.add(DEMO_COURSE_ID);
    }

    const saved = localStorage.getItem("smart_transcriptions_lessons");
    if (saved) {
      try {
        const parsedLessons = JSON.parse(saved);
        if (Array.isArray(parsedLessons)) {
          // Keep only lessons belonging to currently existing courses
          return parsedLessons.filter((l: TranscriptionItem) => activeCourseIds.has(l.courseId));
        }
      } catch (e) {
        console.error("Error parsing lessons", e);
      }
    }

    if (activeCourseIds.has(DEMO_COURSE_ID)) {
      return [DEFAULT_DEMO_LESSON];
    }
    return [];
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(() => {
    const saved = localStorage.getItem("smart_transcriptions_courses");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id; // Default to first valid course
        }
      } catch (e) {
        // Fallback
      }
    }
    return DEMO_COURSE_ID;
  });

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(() => {
    const savedCourses = localStorage.getItem("smart_transcriptions_courses");
    if (savedCourses) {
      try {
        const parsed = JSON.parse(savedCourses);
        if (Array.isArray(parsed) && parsed.some(c => c.id === DEMO_COURSE_ID)) {
          return DEMO_LESSON_ID;
        }
      } catch (e) {
        // Fallback
      }
      return null; // Don't default select the Demo lesson if the Demo course has been deleted
    }
    return DEMO_LESSON_ID;
  });

  const [showTranscribeModal, setShowTranscribeModal] = useState(false);

  // States for transient compressed files (1 minute lifetime)
  const [tempFile, setTempFile] = useState<{ file: File; url: string; expiresAt: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Sync state to localstorage
  useEffect(() => {
    localStorage.setItem("smart_transcriptions_courses", JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem("smart_transcriptions_lessons", JSON.stringify(lessons));
  }, [lessons]);

  // Interval timer to enforce 1-minute transient window
  useEffect(() => {
    if (!tempFile) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const difference = Math.max(0, Math.round((tempFile.expiresAt - now) / 1000));
      
      setTimeLeft(difference);

      if (difference <= 0) {
        clearInterval(interval);
        // Revoke Object URL to delete the file object from memory
        URL.revokeObjectURL(tempFile.url);
        setTempFile(null);
        alert("⚠️ تنبيه هام: انتهت صلاحية الملف الصوتي المضغوط المؤقت (دقيقة واحدة فقط) وتم التخلص منه وحذفه تماماً من الذاكرة محلياً لخصوصية تامة ومراعاة للمساحة.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tempFile]);

  const handleCompressedFileAvailable = (file: File) => {
    // Revoke previous URL to clean up memory
    if (tempFile) {
      URL.revokeObjectURL(tempFile.url);
    }

    const url = URL.createObjectURL(file);
    const duration = 1 * 60; // 1 minute in seconds
    const expiresAt = Date.now() + duration * 1000;

    setTempFile({
      file,
      url,
      expiresAt
    });
    setTimeLeft(duration);

    alert("🎵 تم إعداد ملفك الصوتي المضغوط بمتانة محلياً! سيتوفر للتنزيل لمدة دقيقة واحدة فقط عبر الإشعار العائم المخصص في أسفل الشاشة قبل حذفه تلقائياً.");
  };

  // Handler: Creation of new Folder/Course (Can be root or nested subfolder)
  const handleCreateCourse = (name: string, description: string, parentId?: string) => {
    const newCourse: Course = {
      id: `course_${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      parentId
    };
    setCourses((prev) => [...prev, newCourse]);
    setSelectedCourseId(newCourse.id);
    setSelectedLessonId(null);
  };

  // Handler: Delete Folder/Course along with its nested lessons and subfolders recursively
  const handleDeleteCourse = (id: string) => {
    // Recursive search for all descendent folder IDs
    const getAllFolderIds = (parentId: string): string[] => {
      const directChildren = courses.filter(c => c.parentId === parentId);
      return [parentId, ...directChildren.flatMap(child => getAllFolderIds(child.id))];
    };
    
    const folderIdsToDelete = getAllFolderIds(id);
    
    setCourses((prev) => prev.filter(c => !folderIdsToDelete.includes(c.id)));
    setLessons((prev) => prev.filter(l => !folderIdsToDelete.includes(l.courseId)));
    
    if (selectedCourseId && folderIdsToDelete.includes(selectedCourseId)) {
      setSelectedCourseId(null);
      setSelectedLessonId(null);
    }
  };

  // Handler: Receive and save new transcribed item
  const handleTranscriptionSuccess = (newItem: TranscriptionItem) => {
    setLessons((prev) => [newItem, ...prev]);
    setSelectedCourseId(newItem.courseId);
    setSelectedLessonId(newItem.id);
  };

  // Handler: Live Update fields of lesson (supports title, transcription, summary, etc.)
  const handleUpdateLesson = (id: string, updatedFields: Partial<TranscriptionItem>) => {
    setLessons((prev) => prev.map(l => l.id === id ? { ...l, ...updatedFields } : l));
  };

  // Handler: Live Update fields of folder/course (renaming, etc.)
  const handleUpdateCourse = (id: string, updatedFields: Partial<Course>) => {
    setCourses((prev) => prev.map(c => c.id === id ? { ...c, ...updatedFields } : c));
  };

  // Handler: Delete single transcribed lesson
  const handleDeleteLesson = (id: string) => {
    setLessons((prev) => prev.filter(l => l.id !== id));
    if (selectedLessonId === id) {
      setSelectedLessonId(null);
    }
  };

  // Selected details
  const currentCourse = courses.find(c => c.id === selectedCourseId);
  const currentLesson = lessons.find(l => l.id === selectedLessonId);

  // Filter lessons belonging to selected folder/course
  const currentFolderLessons = lessons.filter(l => l.courseId === selectedCourseId);

  // Database raw backup download / restore option (highly professional and unique!)
  const handleBackupExport = () => {
    const dataObj = { courses, lessons };
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smart_transcriber_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed.courses) && Array.isArray(parsed.lessons)) {
            setCourses(parsed.courses);
            setLessons(parsed.lessons);
            if (parsed.courses.length > 0) {
              setSelectedCourseId(parsed.courses[0].id);
              setSelectedLessonId(null);
            }
            alert("✅ تم استرجاع النسخة الاحتياطية وإعادة تصفيف مجلداتك بنجاح!");
          } else {
            alert("⚠️ تنسيق ملف النسخة الاحتياطية غير متناسق.");
          }
        } catch (err) {
          alert("⚠️ فشل في قراءة محتوى الملف التكويني.");
        }
      };
      fileReader.readAsText(e.target.files[0]);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans select-none antialiased" dir="rtl">
      
      {/* Sidebar Navigation */}
      <Sidebar
        courses={courses}
        lessons={lessons}
        selectedCourseId={selectedCourseId}
        onSelectCourse={setSelectedCourseId}
        selectedLessonId={selectedLessonId}
        onSelectLesson={setSelectedLessonId}
        onCreateCourse={handleCreateCourse}
         onDeleteCourse={handleDeleteCourse}
        onOpenTranscribeModal={() => setShowTranscribeModal(true)}
        onUpdateCourse={handleUpdateCourse}
        onUpdateLesson={handleUpdateLesson}
      />

      {/* Main Panel Canvas */}
      <main className="flex-1 flex flex-col min-w-0 bg-white shadow-inner overflow-hidden">
        
        {currentLesson ? (
          <LessonViewer
            lesson={currentLesson}
            course={currentCourse}
            courses={courses}
            tempFile={tempFile}
            onUpdateLesson={handleUpdateLesson}
            onDeleteLesson={handleDeleteLesson}
          />
        ) : (
          /* Empty / Onboarding State Dashboard view */
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 flex flex-col justify-between items-center bg-radial from-white to-slate-50/10 no-print">
            
            {/* Top Toolbar backup settings */}
            <div className="w-full flex justify-end gap-3 text-xxs text-slate-400 font-medium">
              <button
                onClick={handleBackupExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition-all"
                title="تصدير نسخة احتياطية لكافة المجلدات"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير نسخة احتياطية للتطبيق</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg cursor-pointer transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>استرجاع نسخة احتياطية</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleBackupRestore}
                  className="hidden"
                />
              </label>
            </div>

            {/* Centered Welcome Banner */}
            <div className="max-w-xl text-center space-y-6 my-auto">
              <div className="relative inline-block">
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-md">
                  <Sparkles className="w-8 h-8 animate-pulse text-emerald-600" />
                </div>
                <span className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-ping"></span>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl lg:text-2xl font-black text-slate-800 leading-tight">
                  مرحباً بك في مفرِّغ الدروس والمقالات الذكي
                </h2>
                <p className="text-xs lg:text-sm text-slate-500 leading-relaxed max-w-lg mx-auto">
                  منصتك المتكاملة لتنظيم الأطروحات وتحويل ملفات الصوت والفيديو والروابط إلى نصوص مبوبة بعناوين وموضوعات ذكية، ومناسبة للتصدير متعدد القوالب.
                </p>
              </div>

              {/* Instructions Guides (Bento cards/Step lists) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right pt-4">
                <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-xs space-y-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    ١
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">إنشاء المجلدات</h4>
                  <p className="text-xxs text-slate-400 leading-normal">
                    ابدأ بإنشاء مجلد أو مادة تعليمية جديدة في القائمة الجانبية لتجميع ملفاتك في مكان مغلق ومنسق.
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-xs space-y-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    ٢
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">توفير الصوت/الفيديو</h4>
                  <p className="text-xxs text-slate-400 leading-normal">
                    اضغط زر التفريغ الذكي لارتباط ملف من جهازك أو لصق رابط مباشر ليعمل الذكاء الاصطناعي بشكل فوري.
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-xs space-y-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    ٣
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">التعديل والتصدير</h4>
                  <p className="text-xxs text-slate-400 leading-normal">
                    راجع وتفاعل مع مخرجاتك، صلح الفقرات الكيفية، وصدر الفصول بهيكليات Markdown أو Word أو PDF مطبوعة.
                  </p>
                </div>
              </div>

              {/* Quick Launch CTA Button */}
              <div className="pt-4">
                {currentCourse ? (
                  <button
                    onClick={() => setShowTranscribeModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    ابدأ تفريغ أول مادة في {currentCourse.name}
                  </button>
                ) : (
                  <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-100 p-3 rounded-lg">
                    يرجى تحديد أو إنشاء مجلد من القائمة الجانبية لإطلاق مهام تفريغ الميديا!
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Credits / Tech Info */}
            <div className="text-xxs text-slate-400 font-medium">
              بواسطة نموذج <span className="text-emerald-600 font-bold">Gemini 3.5 Flash</span> • تدوين المعرفة وحفظ العلوم
            </div>

          </div>
        )}

      </main>

      {/* Transcription Overlay Modal */}
      {showTranscribeModal && (
        <LessonTranscriber
          courses={courses}
          selectedCourseId={selectedCourseId}
          onClose={() => setShowTranscribeModal(false)}
          onTranscriptionSuccess={handleTranscriptionSuccess}
          onCompressedFileAvailable={handleCompressedFileAvailable}
        />
      )}

      {/* Temporary Audio File Downloader Card (Visible for 1 minute) */}
      {tempFile && (
        <div className="fixed bottom-6 left-6 z-50 max-w-sm bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl space-y-3 animate-fadeIn" dir="rtl">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl flex-shrink-0">
              <Upload className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">مستند صوتي مؤقت</span>
              <h4 className="text-xs font-bold text-slate-100 truncate" title={tempFile.file.name}>
                {tempFile.file.name}
              </h4>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-xxs font-black text-emerald-400">
              ⏳ الحذف التلقائي: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = tempFile.url;
                link.download = tempFile.file.name;
                link.click();
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xxs font-black rounded-lg shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              تنزيل الملف (WAV)
            </button>
          </div>
          
          <p className="text-slate-400 leading-normal text-right font-medium" style={{ fontSize: '9px' }}>
            ⚠️ سيتحمل المتصفح تخزين هذا الملف لمدة دقيقة واحدة كاملة لتكتمل به أغراض المعاملة والتدوين قبل أن يُمسح ويتم تدمير رابط التسييل بشكل دائم من جهازك.
          </p>
        </div>
      )}

    </div>
  );
}
