'use client'

import { useTheme } from './ThemeProvider'

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex justify-center py-4">
      <button
        onClick={toggleTheme}
        className="w-[80%] relative flex items-center justify-center rounded-full bg-[var(--card)] p-2 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card)] focus:ring-[var(--primary)]"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {/* Sun Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`w-6 h-6 text-yellow-500 transition-transform duration-500 ease-in-out ${ 
            theme === 'dark' ? 'transform -translate-x-6 opacity-0' : 'transform translate-x-0 opacity-100' 
          }`}
        >
          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.106a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5h2.25a.75.75 0 01.75.75zM17.836 17.836a.75.75 0 00-1.06-1.06l-1.59 1.59a.75.75 0 101.06 1.06l1.59-1.59zM12 18a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.894 6.106a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM3 12a.75.75 0 01-.75.75H.75a.75.75 0 010-1.5h2.25A.75.75 0 013 12zM6.164 17.836a.75.75 0 00-1.06-1.06l-1.59 1.59a.75.75 0 101.06 1.06l1.59-1.59z" />
        </svg>

        {/* Moon Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`w-6 h-6 text-slate-400 absolute transition-transform duration-500 ease-in-out ${ 
            theme === 'dark' ? 'transform translate-x-0 opacity-100' : 'transform translate-x-6 opacity-0' 
          }`}
        >
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 004.472-.948.75.75 0 01.818.162.75.75 0 01-.286.948A10.493 10.493 0 0118 16.5a10.5 10.5 0 01-10.5-10.5c0-1.25.22-2.454.62-3.572a.75.75 0 01.948-.286z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

export default ThemeToggle