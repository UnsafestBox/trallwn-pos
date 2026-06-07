import { useState, useEffect, useRef, useCallback } from 'react'

export function useInactivityTimeout(onTimeout, enabled, timeoutMs = 3 * 60 * 1000, warningMs = 30 * 1000) {
  const [secondsLeft, setSecondsLeft] = useState(null) // null = no warning showing
  const resetRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    let warnTimer, logoutTimer, countdownInterval

    function clearAll() {
      clearTimeout(warnTimer)
      clearTimeout(logoutTimer)
      clearInterval(countdownInterval)
    }

    function reset() {
      clearAll()
      setSecondsLeft(null)

      warnTimer = setTimeout(() => {
        let s = Math.round(warningMs / 1000)
        setSecondsLeft(s)
        countdownInterval = setInterval(() => {
          s -= 1
          setSecondsLeft(s)
          if (s <= 0) clearInterval(countdownInterval)
        }, 1000)
        logoutTimer = setTimeout(onTimeout, warningMs)
      }, timeoutMs - warningMs)
    }

    resetRef.current = reset

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      clearAll()
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [onTimeout, enabled, timeoutMs, warningMs])

  // Call this when the user clicks "Stay signed in"
  const dismiss = useCallback(() => resetRef.current?.(), [])

  return { secondsLeft, dismiss }
}
