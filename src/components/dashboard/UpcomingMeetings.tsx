import { formatDateTime } from "@/lib/utils";
import type { Meeting } from "@/lib/types/database";

export function UpcomingMeetings({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return <p className="text-sm text-slate-400">No upcoming meetings scheduled.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <div>
            <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
            {meeting.department && (
              <p className="text-xs text-slate-500">{meeting.department}</p>
            )}
          </div>
          <span className="text-xs font-medium text-ff-dark-blue">
            {formatDateTime(meeting.starts_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
