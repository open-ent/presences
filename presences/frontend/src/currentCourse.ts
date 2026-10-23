import type { Course } from './api';

/** Cours en cours : l'heure courante est comprise entre le début et la fin (comme `CourseUtils.isCurrentCourse`). */
export function currentCourse(courses: Course[], now: Date = new Date()): Course | undefined {
  return courses.find((c) => c.startDate && c.endDate && new Date(c.startDate) < now && new Date(c.endDate) > now);
}
