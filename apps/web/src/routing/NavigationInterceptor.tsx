import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function isModifiedEvent(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isSameOrigin(url: URL) {
  return url.origin === window.location.origin;
}

export default function NavigationInterceptor(): null {
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      let element = event.target as HTMLElement | null;

      while (element && element.tagName !== 'A') {
        element = element.parentElement;
      }

      if (!element) {
        return;
      }

      const anchor = element as HTMLAnchorElement;

      if (anchor.target && anchor.target.toLowerCase() !== '_self') {
        return;
      }

      if (anchor.hasAttribute('download')) {
        return;
      }

      if (anchor.getAttribute('rel') === 'external') {
        return;
      }

      if (isModifiedEvent(event)) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) {
        return;
      }

      const url = new URL(href, window.location.href);
      if (!isSameOrigin(url)) {
        return;
      }

      event.preventDefault();
      navigate(url.pathname + url.search + url.hash, { preventScrollReset: true });
    }

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
    };
  }, [navigate]);

  return null;
}
