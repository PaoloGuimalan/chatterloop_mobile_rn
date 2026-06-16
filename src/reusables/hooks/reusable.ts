/* Webapp helpers — narrow port of webapp/src/reusables/hooks/reusable.ts.
 * Only what auth flows need today is included. */

interface OriginalResponse {
  id: string;
  username: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthdate: string | null;
  date_created: string;
  gender: string | null;
  email: string;
  profile: string;
  is_active: boolean;
  is_verified: boolean;
  is_complete: boolean;
  iat?: number;
  exp?: number;
}

export interface ConvertedResponse {
  fullname: { firstName: string; middleName: string | null; lastName: string };
  birthdate: { month: string; day: string; year: string } | null;
  dateCreated: { date: string; time: string };
  id: string;
  userID: string;
  username: string;
  profile: string;
  gender: string | null;
  email: string;
  password: null;
  isActivated: boolean;
  isVerified: boolean;
  isComplete: boolean;
  __v: number;
  iat: number | undefined;
  exp: number | undefined;
  coverphoto?: string;
}

export function convertLoginResponse(response: OriginalResponse): ConvertedResponse {
  const birthdate = response.birthdate ? new Date(response.birthdate) : null;
  const dateCreated = new Date(response.date_created);

  const twoDigit = (n: number) => (n < 10 ? "0" + n : `${n}`);
  function formatTime(d: Date): string {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    return `${twoDigit(hours)}:${twoDigit(minutes)}:${twoDigit(seconds)} ${ampm}`;
  }

  let birthdateFormatted: ConvertedResponse["birthdate"] = null;
  if (birthdate && !isNaN(birthdate.getTime())) {
    const monthName = birthdate.toLocaleString("en-US", { month: "long" });
    birthdateFormatted = {
      month: monthName,
      day: `${birthdate.getDate()}`.padStart(2, "0"),
      year: `${birthdate.getFullYear()}`,
    };
  }

  let genderFormatted: string | null = null;
  if (response.gender && response.gender.trim() !== "") {
    genderFormatted =
      response.gender.charAt(0).toUpperCase() + response.gender.slice(1).toLowerCase();
  }

  return {
    fullname: {
      firstName: response.first_name || "",
      middleName: response.middle_name || "",
      lastName: response.last_name || "",
    },
    birthdate: birthdateFormatted,
    dateCreated: {
      date: dateCreated.toLocaleDateString("en-US"),
      time: formatTime(dateCreated),
    },
    id: response.id,
    userID: response.id,
    username: response.username,
    profile: response.profile || "none",
    gender: genderFormatted,
    email: response.email || "",
    password: null,
    isActivated: response.is_active,
    isVerified: response.is_verified,
    isComplete: response.is_complete,
    __v: 0,
    iat: response.iat,
    exp: response.exp,
  };
}

export function checkIfValid(values: (string | null | undefined)[]): boolean {
  return values.every((v) => v != null && `${v}`.trim() !== "");
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function monthNameToNumber(name: string): number {
  return MONTHS.indexOf(name.toLowerCase()) + 1;
}

/** True when `userID` is in the active-users slice with sessionStatus=true. */
export function isUserOnline(
  state: { _id?: string; sessionStatus?: boolean }[],
  userID: string,
): boolean {
  return state.some((u) => u.sessionStatus === true && u._id === userID);
}

/** Django-compatible timestamp string with timezone offset, e.g.
 *  "2024-03-05 14:22:01.000 +0800". Mirrors webapp formatToDjangoDate. */
export function formatToDjangoDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const offsetMs = date.getTimezoneOffset() * 60000;
  const offsetHours = Math.floor(Math.abs(offsetMs) / 3600000);
  const offsetMinutes = Math.floor((Math.abs(offsetMs) % 3600000) / 60000);
  const sign = offsetMs <= 0 ? "+" : "-";
  const offsetStr = `${sign}${offsetHours.toString().padStart(2, "0")}${offsetMinutes.toString().padStart(2, "0")}`;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms} ${offsetStr}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format "YYYY-MM-DD" → "March 5, 2024". Defaults to MM/DD/YYYY input. */
export function formattedDateToWords(formattedDate: string, format?: string): string {
  if (!formattedDate) return "";
  let month: string, day: string, year: string;
  if (format === "YYYY-MM-DD") {
    const p = formattedDate.split("-");
    month = p[1]; day = p[2]; year = p[0];
  } else {
    const p = formattedDate.split("/");
    month = p[0]; day = p[1]; year = p[2];
  }
  const mIdx = parseInt(month, 10) - 1;
  const monthName = MONTH_NAMES[mIdx] ?? month;
  return `${monthName} ${parseInt(day, 10)}, ${year}`;
}

/** "5 minutes ago"-style relative time. Mirrors the webapp implementation. */
export function timeSince(dateString: string | number | Date): string {
  const now = new Date();
  const past = new Date(dateString);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;

  return past.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
