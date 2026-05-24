import React, { useState, useEffect } from "react";
import { Course, TranscriptionItem } from "../types";
import { 
  FolderPlus, 
  Folder, 
  FolderOpen,
  Plus, 
  Trash2, 
  BookOpen, 
  Library,
  ChevronLeft,
  ChevronDown,
  Calendar,
  Layers,
  Sparkles,
  Edit3,
  Check,
  FileText,
  FileAudio
} from "lucide-react";

interface SidebarProps {
  courses: Course[];
  lessons: TranscriptionItem[];
  selectedCourseId: string | null;
  onSelectCourse: (id: string | null) => void;
  selectedLessonId: string | null;
  onSelectLesson: (id: string | null) => void;
  onCreateCourse: (name: string, description: string, parentId?: string) => void;
  onDeleteCourse: (id: string) => void;
  onOpenTranscribeModal: () => void;
  onUpdateCourse: (id: string, updatedFields: Partial<Course>) => void;
  onUpdateLesson: (id: string, updatedFields: Partial<TranscriptionItem>) => void;
}

export default function Sidebar({
  courses,
  lessons,
  selectedCourseId,
  onSelectCourse,
  selectedLessonId,
  onSelectLesson,
  onCreateCourse,
  onDeleteCourse,
  onOpenTranscribeModal,
  onUpdateCourse,
  onUpdateLesson
}: SidebarProps) {
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [confirmingCourseId, setConfirmingCourseId] = useState<string | null>(null);
  
  // Folder editing / renaming states
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [editingCourseDesc, setEditingCourseDesc] = useState("");

  // File/Lesson inline renaming state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState("");

  // Subfolders creation states
  const [showAddSubfolderId, setShowAddSubfolderId] = useState<string | null>(null);
  const [subfolderName, setSubfolderName] = useState("");
  const [subfolderDesc, setSubfolderDesc] = useState("");

  // Active expanded folders (Windows Explorer Collapsible states)
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
  const [expandUncategorized, setExpandUncategorized] = useState(true);

  const [sidebarNotification, setSidebarNotification] = useState<string | null>(null);

  const triggerNotification = (message: string) => {
    setSidebarNotification(message);
    setTimeout(() => {
      setSidebarNotification(null);
    }, 4500);
  };

  // Synchronize expanded states whenever selection changes so current item is revealed automatically
  useEffect(() => {
    const updated = { ...expandedCourses };
    let changed = false;

    const expandTowards = (cId: string) => {
      if (!cId) return;
      if (!updated[cId]) {
        updated[cId] = true;
        changed = true;
      }
      const course = courses.find(c => c.id === cId);
      if (course && course.parentId) {
        expandTowards(course.parentId);
      }
    };

    if (selectedCourseId) {
      expandTowards(selectedCourseId);
    }
    if (selectedLessonId) {
      const activeLesson = lessons.find(l => l.id === selectedLessonId);
      if (activeLesson && activeLesson.courseId) {
        expandTowards(activeLesson.courseId);
      }
    }

    if (changed) {
      setExpandedCourses(updated);
    }
  }, [selectedCourseId, selectedLessonId, courses, lessons]);

  const toggleExpand = (courseId: string) => {
    setExpandedCourses(prev => ({
      ...prev,
      [courseId]: !prev[courseId]
    }));
  };

  const handleSubmitCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;
    onCreateCourse(courseName.trim(), courseDesc.trim());
    setCourseName("");
    setCourseDesc("");
    setShowAddCourse(false);
  };

  const handleSubmitSubfolder = (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!subfolderName.trim()) return;
    onCreateCourse(subfolderName.trim(), subfolderDesc.trim(), parentId);
    setSubfolderName("");
    setSubfolderDesc("");
    setShowAddSubfolderId(null);
  };

  // Filter lessons that do not belong to any valid folder (Uncategorized Drawer)
  const uncategorizedLessons = lessons
    .filter(l => !l.courseId || !courses.some(c => c.id === l.courseId))
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", ["ar", "en"], { numeric: true, sensitivity: "base" }));

  // Main Root Courses (parentId is null/undefined)
  const rootCourses = courses
    .filter(c => !c.parentId)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", ["ar", "en"], { numeric: true, sensitivity: "base" }));

  // Recursive render component for the Explorer Tree
  const renderFolderNode = (course: Course, depth: number = 0) => {
    const isExpanded = !!expandedCourses[course.id];
    const isSelected = selectedCourseId === course.id;
    const subfolders = courses
      .filter(c => c.parentId === course.id)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", ["ar", "en"], { numeric: true, sensitivity: "base" }));
    const directLessons = lessons
      .filter(l => l.courseId === course.id)
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", ["ar", "en"], { numeric: true, sensitivity: "base" }));

    // Dynamic recursive counting of files inside lessons tree
    const getFolderFamilyIds = (pId: string): string[] => {
      const direct = courses.filter(c => c.parentId === pId);
      return [pId, ...direct.flatMap(d => getFolderFamilyIds(d.id))];
    };
    const familyIds = getFolderFamilyIds(course.id);
    const totalLessonsCount = lessons.filter(l => familyIds.includes(l.courseId)).length;

    const hasChildren = subfolders.length > 0 || directLessons.length > 0;

    return (
      <div key={course.id} className="space-y-1">
        {/* Course Folder Row */}
        {editingCourseId === course.id ? (
          <div
            className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs space-y-2 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <label className="block text-xxs font-bold text-slate-500">اسم المجلد الجديد:</label>
              <input
                type="text"
                value={editingCourseName}
                onChange={(e) => setEditingCourseName(e.target.value)}
                className="w-full text-xs p-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                placeholder="اسم المجلد الحالي..."
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xxs font-bold text-slate-500">الوصف المحدث:</label>
              <input
                type="text"
                value={editingCourseDesc}
                onChange={(e) => setEditingCourseDesc(e.target.value)}
                className="w-full text-xxs p-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                placeholder="الوصف (اختياري)"
              />
            </div>
            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setEditingCourseId(null)}
                className="px-2 py-1 text-xxs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingCourseName.trim()) {
                    onUpdateCourse(course.id, { name: editingCourseName.trim(), description: editingCourseDesc.trim() });
                    setEditingCourseId(null);
                  }
                }}
                className="px-2 py-1 text-xxs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-0.5 transition-all cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>حفظ التعديل</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.add("bg-sky-50/80", "border-sky-200", "scale-[1.008]");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("bg-sky-50/80", "border-sky-200", "scale-[1.008]");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("bg-sky-50/80", "border-sky-200", "scale-[1.008]");
              const lessonId = e.dataTransfer.getData("text/plain");
              if (lessonId) {
                onUpdateLesson(lessonId, { courseId: course.id });
                const destTitle = lessons.find(l => l.id === lessonId)?.title || "المحدد";
                triggerNotification(`📂 تم نقل "${destTitle}" بنجاح إلى مجلد: "${course.name}"`);
              }
            }}
            className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-150 border ${
              isSelected
                ? "bg-sky-50/80 border-sky-100 text-sky-950 shadow-xxs ring-1 ring-sky-200/55"
                : "bg-white hover:bg-slate-50 border-slate-100/70 text-slate-700 hover:border-slate-200"
            }`}
            onClick={() => {
              onSelectCourse(course.id);
              onSelectLesson(null);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleExpand(course.id);
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {/* Expand status indicator / Chevron */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(course.id);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="توسيع المجلد"
              >
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  )
                ) : (
                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                  </div>
                )}
              </button>

              {/* Folder Icon representing Open / Closed values */}
              {isExpanded && hasChildren ? (
                <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-sky-600" : "text-amber-500 fill-amber-400/20"}`} />
              ) : (
                <Folder className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-sky-600" : "text-amber-500 fill-amber-400/20"}`} />
              )}

              <div className="min-w-0 flex-1">
                <p className={`text-xs ${isSelected ? "font-bold text-sky-950" : "font-semibold"} truncate leading-tight`}>{course.name}</p>
                {course.description && depth === 0 && (
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{course.description}</p>
                )}
              </div>
            </div>

            {/* Folder Actions Panel */}
            {confirmingCourseId === course.id ? (
              <div className="flex items-center gap-1 flex-shrink-0 animate-fadeIn bg-white p-0.5 rounded shadow-sm border border-slate-150">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCourse(course.id);
                    setConfirmingCourseId(null);
                  }}
                  className="px-1.5 py-0.5 text-[9.5px] font-bold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  حذف
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingCourseId(null);
                  }}
                  className="px-1.5 py-0.5 text-[9.5px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${isSelected ? "bg-sky-100 text-sky-850" : "bg-slate-100 text-slate-500"}`}>
                  {totalLessonsCount}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddSubfolderId(course.id);
                    setSubfolderName("");
                    setSubfolderDesc("");
                  }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded transition-all"
                  title="إضافة مجلد فرعي بالداخل"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCourseId(course.id);
                    setEditingCourseName(course.name);
                    setEditingCourseDesc(course.description || "");
                  }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all"
                  title="تعديل المجلد"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingCourseId(course.id);
                  }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-all"
                  title="حذف المجلد وكل محتوياته"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Subfolder form nested inside the explorer hierarchy */}
        {showAddSubfolderId === course.id && (
          <form
            onSubmit={(e) => handleSubmitSubfolder(e, course.id)}
            className="p-2.5 bg-emerald-50/40 rounded-lg border border-dashed border-emerald-200 space-y-2 mb-1 cursor-default animate-fadeIn mr-2.5 pr-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              required
              placeholder="اسم المجلد الفرعي الجديد..."
              value={subfolderName}
              onChange={(e) => setSubfolderName(e.target.value)}
              className="w-full text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setShowAddSubfolderId(null)}
                className="px-1.5 py-0.5 text-xxs text-slate-500 hover:bg-slate-100 rounded"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-1.5 py-0.5 text-xxs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold"
              >
                إضافة
              </button>
            </div>
          </form>
        )}

        {/* Guides layout containing lessons and recursive subfolders */}
        {isExpanded && (
          <div 
            className="border-r border-slate-200/80 mr-3 pr-2 space-y-1.5 pt-1 pb-1 ml-0 animate-fadeIn"
          >
            {/* Folder-children Courses */}
            {subfolders.map(sub => renderFolderNode(sub, depth + 1))}

            {/* Folder-children File Lessons */}
            {directLessons.map(lesson => {
              const isLessonSelected = selectedLessonId === lesson.id;
              const isEditingThisLesson = editingLessonId === lesson.id;

              if (isEditingThisLesson) {
                return (
                  <div
                    key={lesson.id}
                    className="p-2 bg-slate-800 rounded-lg border border-slate-700 space-y-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editingLessonTitle}
                      onChange={(e) => setEditingLessonTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingLessonTitle.trim()) {
                          onUpdateLesson(lesson.id, { title: editingLessonTitle.trim() });
                          setEditingLessonId(null);
                        }
                        if (e.key === "Escape") setEditingLessonId(null);
                      }}
                      className="w-full text-xxs p-1 border border-slate-650 rounded bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingLessonId(null)}
                        className="px-2 py-0.5 text-xxs bg-slate-700 text-slate-300 rounded"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingLessonTitle.trim()) {
                            onUpdateLesson(lesson.id, { title: editingLessonTitle.trim() });
                            setEditingLessonId(null);
                          }
                        }}
                        className="px-2 py-0.5 text-xxs bg-emerald-600 text-white rounded font-bold"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={lesson.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", lesson.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLesson(lesson.id);
                  }}
                  className={`group flex items-center justify-between px-2 py-1 rounded-md cursor-grab active:cursor-grabbing transition-all ${
                    isLessonSelected
                      ? "bg-slate-800 text-white font-semibold shadow-xs"
                      : "hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-transparent hover:border-slate-150"
                  }`}
                  title={`${lesson.title} - اسحب لنقله بيدك لمجلد آخر`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {lesson.sourceType === "file" ? (
                      <FileAudio className={`w-3.5 h-3.5 flex-shrink-0 ${isLessonSelected ? "text-emerald-400" : "text-blue-500"}`} />
                    ) : (
                      <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isLessonSelected ? "text-cyan-400" : "text-indigo-500"}`} />
                    )}
                    <span className="text-xxs truncate leading-tight">{lesson.title}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLessonId(lesson.id);
                        setEditingLessonTitle(lesson.title);
                      }}
                      className={`p-0.5 rounded hover:bg-slate-200/50 ${isLessonSelected ? "text-slate-300 hover:text-white" : "text-slate-400 hover:text-emerald-600"}`}
                      title="إعادة تسمية الملف"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {!hasChildren && (
              <p className="text-[10px] text-slate-300 italic pr-6 py-0.5">
                (المجلد فارغ)
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-80 border-r border-slate-100 bg-slate-50 flex flex-col h-full no-print select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-none">مُفرِّغ الصوتيات</h1>
            <span className="text-xs text-slate-400 font-medium">منظم ومفرغ الدروس الذكي</span>
          </div>
        </div>
      </div>

      {/* Hierarchical Explorer Scrollable Engine */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Library className="w-3.5 h-3.5" />
              مستعرض الملفات والمجلدات ({courses.length})
            </span>
            <button
              onClick={() => setShowAddCourse(!showAddCourse)}
              className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-md transition-colors"
              title="إضافة مجلد رئيسي جديد"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* New Root Course Form */}
          {showAddCourse && (
            <form onSubmit={handleSubmitCourse} className="bg-white p-3 rounded-xl border border-dashed border-emerald-200 shadow-sm mb-4 space-y-3 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">اسم المجلد / الكورس</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: دبلومة ريأكت المتكاملة"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">وصف المجلد (اختياري)</label>
                <textarea
                  placeholder="وصف مختصر لمحتويات المجلد..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCourse(false)}
                  className="px-2.5 py-1 text-xxs text-slate-500 hover:bg-slate-100 rounded-md transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xxs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all shadow-sm"
                >
                  حفظ المجلد
                </button>
              </div>
            </form>
          )}

          {/* Core Explorer Tree Wrapper */}
          <div className="space-y-2">
            
            {/* 1. All Folder-based Hierarchical nodes */}
            {rootCourses.length > 0 && (
              <div className="space-y-1.5">
                {rootCourses.map((parent) => renderFolderNode(parent, 0))}
              </div>
            )}

            {/* 2. Uncategorized Files drawer (matches Windows File Explorer "general/unclassified" items) */}
            {uncategorizedLessons.length > 0 && (
              <div className="space-y-1">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add("bg-slate-100", "border-slate-300");
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove("bg-slate-100", "border-slate-300");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("bg-slate-100", "border-slate-300");
                    const lessonId = e.dataTransfer.getData("text/plain");
                    if (lessonId) {
                      onUpdateLesson(lessonId, { courseId: "" });
                      const destTitle = lessons.find(l => l.id === lessonId)?.title || "المحدد";
                      triggerNotification(`📂 تم إلغاء تبويب "${destTitle}" ونقله للملفات العامة`);
                    }
                  }}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all border ${
                    !selectedCourseId && selectedLessonId && uncategorizedLessons.some(l => l.id === selectedLessonId)
                      ? "bg-slate-100 border-slate-200 text-slate-800 font-semibold"
                      : "bg-white hover:bg-slate-100/50 border-slate-100 text-slate-500"
                  }`}
                  onClick={() => {
                    onSelectCourse(null);
                    onSelectLesson(null);
                  }}
                  onDoubleClick={() => setExpandUncategorized(!expandUncategorized)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandUncategorized(!expandUncategorized);
                      }}
                      className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded"
                    >
                      {expandUncategorized ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronLeft className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <Folder className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-semibold truncate leading-tight">الملفات غير المبوّبة</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500">
                    {uncategorizedLessons.length}
                  </span>
                </div>

                {expandUncategorized && (
                  <div className="border-r border-slate-200/60 mr-3 pr-2.5 space-y-1 pt-1 pb-1 ml-0 animate-fadeIn">
                    {uncategorizedLessons.map(lesson => {
                      const isLessonSelected = selectedLessonId === lesson.id;
                      const isEditingThisLesson = editingLessonId === lesson.id;

                      if (isEditingThisLesson) {
                        return (
                          <div
                            key={lesson.id}
                            className="p-2 bg-slate-800 rounded-lg border border-slate-700 space-y-1.5 animate-fadeIn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingLessonTitle}
                              onChange={(e) => setEditingLessonTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingLessonTitle.trim()) {
                                  onUpdateLesson(lesson.id, { title: editingLessonTitle.trim() });
                                  setEditingLessonId(null);
                                }
                                if (e.key === "Escape") setEditingLessonId(null);
                              }}
                              className="w-full text-xxs p-1 border border-slate-600 rounded bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                              autoFocus
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingLessonId(null)}
                                className="px-2 py-0.5 text-xxs bg-slate-700 text-slate-300 rounded"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingLessonTitle.trim()) {
                                    onUpdateLesson(lesson.id, { title: editingLessonTitle.trim() });
                                    setEditingLessonId(null);
                                  }
                                }}
                                className="px-2 py-0.5 text-xxs bg-emerald-600 text-white rounded font-bold"
                              >
                                حفظ
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={lesson.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", lesson.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLesson(lesson.id);
                          }}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all ${
                            isLessonSelected
                              ? "bg-slate-800 text-white font-semibold shadow-xs"
                              : "hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-transparent hover:border-slate-150"
                          }`}
                          title={`${lesson.title} - اسحب الملف للتبويب`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {lesson.sourceType === "file" ? (
                              <FileAudio className={`w-3.5 h-3.5 flex-shrink-0 ${isLessonSelected ? "text-emerald-400" : "text-slate-400"}`} />
                            ) : (
                              <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isLessonSelected ? "text-cyan-400" : "text-slate-400"}`} />
                            )}
                            <span className="text-xxs truncate leading-tight">{lesson.title}</span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLessonId(lesson.id);
                                setEditingLessonTitle(lesson.title);
                              }}
                              className={`p-0.5 rounded hover:bg-slate-200/50 ${isLessonSelected ? "text-slate-300 hover:text-white" : "text-slate-400 hover:text-emerald-600"}`}
                              title="إعادة تسمية الملف"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Empty explorer fallback */}
            {rootCourses.length === 0 && uncategorizedLessons.length === 0 && (
              <div className="text-center py-10 px-3 bg-white border border-slate-100 rounded-xl text-slate-400">
                <FolderPlus className="w-9 h-9 mx-auto mb-3 text-slate-300 stroke-1" />
                <p className="text-xs">المستعرض فارغ حالياً.</p>
                <p className="text-[10px] text-slate-400 mt-1">ابدأ بإضافة مجلد لتنظيم دروسك أو ارفع ملف صوتي.</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {sidebarNotification && (
        <div className="absolute bottom-24 right-4 left-4 p-3 bg-emerald-600 text-white text-[11px] font-bold rounded-xl shadow-lg border border-emerald-500/50 flex items-center gap-2 animate-fadeIn z-50">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-right">{sidebarNotification}</span>
        </div>
      )}

      {/* Footer Info & Transcription Launcher */}
      <div className="p-4 border-t border-slate-100 bg-white space-y-3">
        {/* Quick action: Launch Transcription */}
        <button
          onClick={onOpenTranscribeModal}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 hover:shadow-md transition-all active:scale-98 shadow-sm cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          ابدأ تفريغ ملف ذكي
        </button>

        {/* Info stats */}
        <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-slate-400 font-medium">
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            <span>إجمالي الدروس: {lessons.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>اليوم: {new Date().toLocaleDateString('ar-EG', {month: 'numeric', day: 'numeric'})}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
