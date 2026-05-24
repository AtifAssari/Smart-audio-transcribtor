/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Course {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  parentId?: string; // Optional ID of parent course
}

export interface TranscriptionItem {
  id: string;
  courseId: string;
  title: string;
  sourceType: 'file' | 'url' | 'paste';
  sourceName: string;
  transcription: string; // Structured Markdown
  summary?: string; // Short summary
  createdAt: string;
  duration?: string; // Estimated duration
  language?: string; // Transcribed language (e.g. "Arabic", "English")
}

export interface ServerResponse {
  success: boolean;
  transcription?: string;
  summary?: string;
  language?: string;
  error?: string;
}
