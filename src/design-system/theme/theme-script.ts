export const THEME_STORAGE_KEY = 'musoko.theme';
export type ThemeName = 'yellow' | 'green';

/**
 * Runs in <head> before first paint. Reads the stored choice, else the system
 * preference, and sets data-theme and the theme-color meta. Storage may be
 * blocked, so everything sits in try/catch and falls back to the system choice.
 */
export const themeScript = `(function(){var d=document.documentElement,t=null;try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(s==='yellow'||s==='green')t=s}catch(e){}if(!t){try{t=window.matchMedia('(prefers-color-scheme: dark)').matches?'green':'yellow'}catch(e){t='yellow'}}d.setAttribute('data-theme',t);try{var g=getComputedStyle(d).getPropertyValue('--theme-ground').trim();if(g){var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}m.content=g}}catch(e){}})();`;
