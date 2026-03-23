import React from 'react';

export function Link({ href, children, ...props }: { href: string; children?: React.ReactNode } & Record<string, unknown>) {
  return React.createElement('a', { href, ...props }, children);
}

export function useLocation(): [string, (to: string) => void] {
  return ['/', () => undefined];
}

export function useRoute(): [boolean, Record<string, string>] {
  return [false, {}];
}

export function Route() {
  return null;
}

export function Switch({ children }: { children?: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function Redirect() {
  return null;
}
