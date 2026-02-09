interface AdminAlertsProps {
  error: string | null;
  success: string | null;
}

export default function AdminAlerts({ error, success }: AdminAlertsProps) {
  return (
    <>
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-200">
          {success}
        </div>
      )}
    </>
  );
}
