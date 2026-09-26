function BaseIcon({ children, className = '', size = 18, strokeWidth = 1.9 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function QuestionMasterMark({ size = 48, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="14" fill="#0B7C72" />
      <path d="M9 15.5c4.9-2.2 9.9-1.9 15 1.1v20.2c-5.1-3-10.1-3.3-15-1.1V15.5Z" fill="#F7FFFD" />
      <path d="M39 15.5c-4.9-2.2-9.9-1.9-15 1.1v20.2c5.1-3 10.1-3.3 15-1.1V15.5Z" fill="#D8F1EC" />
      <path d="M24 16.6v20.2" stroke="#0B7C72" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="35.5" cy="12.5" r="7.5" fill="#F4A261" />
      <path d="M33.2 10.6a2.6 2.6 0 1 1 4.1 2.1c-1 .7-1.8 1-1.8 2.2M35.5 17.8h.01" stroke="#3A2209" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </BaseIcon>
  );
}

export function DashboardIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4 13h6V4H4z" />
      <path d="M14 20h6v-9h-6z" />
      <path d="M14 10h6V4h-6z" />
      <path d="M4 20h6v-3H4z" />
    </BaseIcon>
  );
}

export function QuizIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </BaseIcon>
  );
}

export function PencilIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
    </BaseIcon>
  );
}

export function MarkingIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </BaseIcon>
  );
}

export function LogoutIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </BaseIcon>
  );
}

export function PlusIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function PublishedIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m5 12 4 4L19 6" />
    </BaseIcon>
  );
}

export function PendingIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </BaseIcon>
  );
}

export function ReleasedIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m14 3 7 7-7 7" />
      <path d="M3 12h18" />
    </BaseIcon>
  );
}

export function StudentsIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a4 4 0 0 1 0 7.75" />
    </BaseIcon>
  );
}

export function SearchIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </BaseIcon>
  );
}

export function ResultsIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4 19h16" />
      <path d="M7 16V8" />
      <path d="M12 16V5" />
      <path d="M17 16v-4" />
    </BaseIcon>
  );
}

export function CalendarIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </BaseIcon>
  );
}

export function TimerIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M9 3h6" />
      <path d="M15.5 5.5 17 4" />
    </BaseIcon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  );
}

export function ChevronUpIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m18 15-6-6-6 6" />
    </BaseIcon>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </BaseIcon>
  );
}

export function ArrowRightIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m12 5 7 7-7 7" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function CheckCircleIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </BaseIcon>
  );
}

export function AlertIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </BaseIcon>
  );
}

export function ShieldIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </BaseIcon>
  );
}

export function UserCheckIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </BaseIcon>
  );
}

export function RefreshIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M21 21v-5h-5" />
    </BaseIcon>
  );
}
