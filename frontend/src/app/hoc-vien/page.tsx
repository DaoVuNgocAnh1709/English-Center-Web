import { StudentExamHistory } from "@/components/student-exam-history";
import { StudentProfile } from "@/components/student-profile";

export const metadata = { title: "Hồ sơ học viên" };

export default function StudentPage() {
  return <><StudentProfile/><StudentExamHistory/></>;
}
