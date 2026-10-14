import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    // Dark is the product's default look (premium charcoal + amber);
    // persisting 'light' is the only way back to light.
    try { return localStorage.getItem('dd-theme') !== 'light'; } catch (e) { return true; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('dd-theme', dark ? 'dark' : 'light'); } catch (e) { /* noop */ }

    /* Status-bar theming for the installed PWA: the Android Chrome status bar
       paints this color, so it must match the app surface in BOTH themes or a
       jarring white strip floats above Night Shift. */
    const brandColor = dark ? '#101412' : '#F4F7F3';
    let meta = document.head.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', brandColor);
    if (typeof window !== 'undefined' && window.__updatePwaThemeColor) {
      try { window.__updatePwaThemeColor(brandColor); } catch (e) { /* noop */ }
    }
  }, [dark]);

  const toggle = () => setDark((d) => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
