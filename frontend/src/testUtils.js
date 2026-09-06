import { act } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Tiny dependency-free helpers for component tests (React 19 + jsdom).
 * No @testing-library packages are required by this project.
 */

const mountedRoots = [];

export async function render(ui) {
  const container = document.createElement('div');
  container.setAttribute('data-test-root', 'true');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  await act(async () => {
    root.render(ui);
  });
  return { container, root };
}

export async function unmountAll() {
  const pending = mountedRoots.splice(0);
  for (const { root, container } of pending) {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
}

export async function cleanupTests() {
  await unmountAll();
  document.body.innerHTML = '';
}

export function findByTestId(container, id) {
  return container.querySelector(`[data-testid="${id}"]`);
}

export function findText(container, text) {
  return Array.from(container.querySelectorAll('*')).find(
    (el) => el.textContent && el.textContent.includes(text) && el.children.length === 0
  );
}

export function hasText(container, text) {
  return Boolean(findText(container, text));
}

export async function click(element) {
  if (!element) throw new Error('click() target not found');
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

export async function submitForm(form) {
  if (!form) throw new Error('submitForm() target not found');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

export async function typeText(input, value) {
  if (!input) throw new Error('typeText() target not found');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
