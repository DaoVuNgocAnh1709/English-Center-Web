export const schoolLevels = [
  { value: "PRESCHOOL", label: "Mầm non", grades: [0] },
  { value: "PRIMARY", label: "Tiểu học", grades: [1, 2, 3, 4, 5] },
  { value: "MIDDLE", label: "THCS", grades: [6, 7, 8, 9] },
  { value: "HIGH", label: "THPT", grades: [10, 11, 12] },
] as const;

export const materialCategories = [
  "Ngữ pháp",
  "Từ vựng",
  "Phát âm",
  "Đọc hiểu",
  "Nghe",
  "Viết",
  "Giao tiếp",
  "Bài tập",
  "Luyện thi",
  "Đề kiểm tra",
  "Tài liệu giáo viên",
  "Khác",
] as const;

export const materialTypes = [
  { value: "DOCUMENT", label: "Tài liệu" },
  { value: "WORKSHEET", label: "Phiếu bài tập" },
  { value: "EXAM", label: "Đề kiểm tra" },
  { value: "VIDEO", label: "Video" },
] as const;

export function gradesForLevel(level: string): readonly number[] {
  return schoolLevels.find((item) => item.value === level)?.grades ?? [];
}

export function gradeLabel(grade: number) {
  return grade === 0 ? "Mầm non" : `Lớp ${grade}`;
}
